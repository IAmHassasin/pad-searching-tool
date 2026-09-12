# Search: default min monster ID (modern-only corpus)

**Date:** 2026-09-12  
**Status:** Approved for planning (user: bypass rule A, Approach 1, cutoff 5000)  
**Endpoint:** `GET /monsters/search`

## Summary

Most PAD cards with `monster_id` below ~5000 are obsolete for typical filter browsing. Default search should exclude them to shrink SQLite regex/COUNT work and JSON payloads (helps slow links and weak devices). Older cards remain reachable when the user enters a **pure numeric** `idQuery` (exact `monster_id` or `monster_no_na`).

## Context (why)

| Fact | Evidence |
|------|----------|
| Seed corpus | ~14.5k monsters; ~5k with `monster_id < 5000` (~34%) |
| Hot path | `PatternSearchService.search` wraps full `SOURCE_QUERY`, JS `regexp()` / effect UDFs per row, COUNT + SELECT |
| FE | `searchAllMonsters` pages at limit 5000 until all matches loaded |
| Payload | Full-row JSON; obsolete IDs are wasted bytes on wire + client sort |

This change is **Approach 1** only (BE floor + numeric bypass + light FE hint). Stopping full-result paging / server sort / slim columns is deferred.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Cutoff | `SEARCH_MIN_MONSTER_ID=5000` |
| Bypass | Digits-only `idQuery` after trim → exact ID/NA#; **no** floor |
| Name / substring ID | Non-numeric `idQuery` keeps LIKE; **floor still applies** |
| Exact match shape | `monster_id = N OR monster_no_na = N` (no `%N%`, no name LIKE) |
| Other APIs | `/monsters/lookup`, evo, collab, events, team: **unchanged** (any ID) |
| Disable floor | Env `0` or empty → no min-ID clause |
| FE | Short “modern only” hint + ID field helper copy; no fetch-strategy change in this pass |

## Non-goals (this change)

- FE stop paging until `total` / virtualized-only fetch
- Server `ORDER BY` or changing page size caps
- Materialized search view or dropping cooldown subquery from `SOURCE_QUERY`
- Slimmer response column sets
- Hiding low IDs only in the UI while still returning them from the API

---

## §1 Search semantics

| `idQuery` (trimmed) | Floor `monster_id >= min` | ID predicate |
|---------------------|---------------------------|--------------|
| Empty / absent | Yes (if min &gt; 0) | None |
| Digits only (`/^\d+$/`) | **No** | Exact: `monster_id = N OR monster_no_na = N` where `N = Number(q)` |
| Otherwise (name text, mixed) | Yes (if min &gt; 0) | Existing LIKE on `monster_id`, `monster_no_na`, `name_en` |

**Parsing notes**

- Trim whitespace before digit check.
- Leading zeros (`04500`) are digits-only; match with `Number("04500")` → `4500`.
- Values like `5000abc` are **not** numeric bypass → floor + LIKE.

Combine floor and other filters with **AND** (same as today).

---

## §2 Backend

### Config

- Env: `SEARCH_MIN_MONSTER_ID` (default **5000** when unset in app code; document in `.env.example`).
- Parse: non-negative integer; `0` or empty string → disabled.

### Implementation

- Pure helper (unit-testable, no Nest): e.g. `resolveSearchIdQuery(idQuery, minMonsterId)` →  
  `{ applyMinId: boolean; minMonsterId: number; exactId: number | null; likeQuery: string | null; modernOnly: boolean }`.
- Wire into `PatternSearchService` monster WHERE builder (replace current always-LIKE `idQuery` branch).
- Apply min-ID clause when `applyMinId && minMonsterId > 0`:  
  `CAST(COALESCE(_src."monster_id", _src.__source_pk) AS INTEGER) >= ?`

### Response metadata

Extend `/monsters/search` JSON with:

| Field | Type | Meaning |
|-------|------|---------|
| `minMonsterId` | `number` | Effective floor (0 if disabled) |
| `modernOnly` | `boolean` | `true` when floor was applied for this request |

FE uses these for the hint; clients that ignore them keep working.

---

## §3 Frontend (minimal)

- When search response has `modernOnly === true` and `minMonsterId > 0`, show a short results-area hint, e.g.  
  **Showing monsters #5000+. Enter an exact ID (or NA#) for older cards.**
- Update ID filter placeholder / summary copy so “exact ID / NA#” vs name is clear.
- No change to `searchAllMonsters` paging in this pass.
- Share URLs unchanged; semantics follow the new BE rules.

---

## §4 Tests & verification

Repo currently has no Nest/Vitest suite for API. For this change:

1. Add `node:test` (or minimal runner) covering the **pure** `resolveSearchIdQuery` helper: empty, digits, leading zeros, mixed, floor on/off.
2. Manual / smoke: filter without id → no rows with `monster_id < 5000`; `idQuery=4500` → that card if present; `idQuery=Anubis` → floor still on; lookup/evo still return low IDs.

---

## §5 Follow-ups (explicitly later)

1. Cap or stream FE fetch instead of loading all matching pages.
2. Optional server sort + smaller page default for weak devices.
3. Materialize / slim `SOURCE_QUERY` for the filter path (cooldown subquery deferred).

---

## Spec self-review

- [x] No unresolved placeholders (`TBD` / `TODO` in normative sections)
- [x] Consistent with locked decisions (A, Approach 1, 5000)
- [x] Scope single-concern; deferred work listed under Non-goals / Follow-ups
- [x] Edge cases: trim, leading zeros, mixed strings, disable via `0`
