# Search min monster ID Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Default `GET /monsters/search` to `monster_id >= 5000`, with digits-only `idQuery` bypassing the floor for exact ID/NA# lookup, plus a light FE hint.

**Architecture:** Pure helper `resolveSearchIdQuery` decides floor vs exact vs LIKE. `PatternSearchService` always ANDs the floor (even with no other monster filters) and returns `minMonsterId` / `modernOnly`. FE shows a results hint from that metadata; paging is unchanged.

**Tech Stack:** NestJS + TypeORM/SQLite, React/Vite, `node:test` for the helper.

**Spec:** `docs/superpowers/specs/2026-09-12-search-min-monster-id-design.md`

## Global Constraints

- Cutoff default `SEARCH_MIN_MONSTER_ID=5000` when env unset
- Env `0` or empty string → no min-ID clause
- Digits-only trimmed `idQuery` (`/^\d+$/`) → exact `monster_id = N OR monster_no_na = N`, **no** floor
- Name / mixed `idQuery` keeps LIKE **and** the floor
- Other APIs (`/monsters/lookup`, evo, collab, events, team) unchanged
- No change to `searchAllMonsters` paging / page size
- Share URLs unchanged
- Do not commit unless the user explicitly asks

## File map

| File | Responsibility |
|------|----------------|
| `src/api/search-id-query.ts` | Parse env + resolve idQuery semantics |
| `src/api/search-id-query.test.ts` | `node:test` cases for the helper |
| `src/api/pattern-search.service.ts` | WHERE clauses + response metadata |
| `.env.example` | Document `SEARCH_MIN_MONSTER_ID` |
| `package.json` | `npm test` script |
| `web/src/types.ts` | `minMonsterId` / `modernOnly` on search response |
| `web/src/api.ts` | Pass metadata through `searchAllMonsters` |
| `web/src/components/ModernOnlySearchHint.tsx` | Results-area hint |
| `web/src/components/ResultsPanel.tsx` | Show hint |
| `web/src/components/MobileWebviewLayout.tsx` | Show hint |
| `web/src/components/filters/monster-filter-shared.tsx` | ID placeholder / summary copy |
| `web/src/App.tsx` | Wire metadata into both layouts |

---

### Task 1: Pure helper + unit tests

**Files:**
- Create: `src/api/search-id-query.ts`
- Create: `src/api/search-id-query.test.ts`
- Modify: `package.json` (`test` script)
- Modify: `tsconfig.json` (exclude `**/*.test.ts` so Nest build stays clean)

**Interfaces:**
- Produces:
  - `parseSearchMinMonsterId(raw: string | undefined): number`
  - `resolveSearchIdQuery(idQuery: string | undefined, minMonsterId: number): SearchIdQueryResolution`
  - `SearchIdQueryResolution = { applyMinId: boolean; minMonsterId: number; exactId: number | null; likeQuery: string | null; modernOnly: boolean }`

- [x] **Step 1: Write the failing tests** in `src/api/search-id-query.test.ts`

Cover: unset env → 5000; empty/`0` → 0; `"5000"` → 5000; invalid → 5000. Empty idQuery applies floor; digits-only bypass + `Number("04500")===4500`; mixed `5000abc` keeps LIKE + floor; floor off → `applyMinId`/`modernOnly` false.

- [x] **Step 2: Run tests — expect FAIL** (module missing)

Run: `node --experimental-strip-types --test src/api/search-id-query.test.ts`

- [x] **Step 3: Implement helper**

- Default 5000 when `raw === undefined`
- Trim; empty → 0; `/^\d+$/` → `Number(trimmed)`; else 5000
- Empty query: `applyMinId = minMonsterId > 0`, `modernOnly` same, `exactId`/`likeQuery` null
- Digits-only: `applyMinId=false`, `modernOnly=false`, `exactId=Number(q)`
- Else: floor as empty case, `likeQuery=q`
- `minMonsterId` in the result is the configured floor (`0` if disabled), including during bypass

- [x] **Step 4: Run tests — expect PASS**

---

### Task 2: Wire PatternSearchService

**Files:**
- Modify: `src/api/pattern-search.service.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `parseSearchMinMonsterId`, `resolveSearchIdQuery`
- Produces: search JSON `{ minMonsterId: number; modernOnly: boolean; ...existing }`

- [x] **Step 1: Apply ID resolution in `compileWhere` even when `monster` is undefined**

```ts
const idQuery = resolveSearchIdQuery(
  input.monster?.idQuery,
  parseSearchMinMonsterId(process.env.SEARCH_MIN_MONSTER_ID)
);
```

- Floor when `idQuery.applyMinId && idQuery.minMonsterId > 0`:
  `CAST(COALESCE(_src."monster_id", _src.__source_pk) AS INTEGER) >= ?`
- Exact when `idQuery.exactId != null`:
  `CAST(COALESCE(_src."monster_id", _src.__source_pk) AS INTEGER) = ? OR CAST(COALESCE(_src."monster_no_na", 0) AS INTEGER) = ?`
- LIKE when `idQuery.likeQuery != null`: keep the existing three-column LIKE
- Remove the always-LIKE branch from `buildMonsterWhere`
- Return `minMonsterId` / `modernOnly` from `search()`

- [x] **Step 2: Document env in `.env.example`**

```
# Default search excludes monster_id below this (0 or empty = disabled).
SEARCH_MIN_MONSTER_ID=5000
```

---

### Task 3: Frontend hint + ID copy

**Files:**
- Modify: `web/src/types.ts`, `web/src/api.ts`, `web/src/App.tsx`
- Create: `web/src/components/ModernOnlySearchHint.tsx`
- Modify: `web/src/components/ResultsPanel.tsx`, `web/src/components/MobileWebviewLayout.tsx`, `web/src/components/filters/monster-filter-shared.tsx`

- [x] **Step 1: Extend types + `searchAllMonsters`**

`MonsterSearchResponse` and `searchAllMonsters` return `minMonsterId` / `modernOnly` from the first page. **Do not** change page size or the paging loop.

- [x] **Step 2: Hint + ID copy**

When `modernOnly === true && minMonsterId > 0` show:
`Showing monsters #{minMonsterId}+. Enter an exact ID (or NA#) for older cards.`

ID filter: summary `exact ID/NA# or name`; placeholder `Exact ID or NA# (older cards), or name…`

Wire both desktop `ResultsPanel` and `MobileWebviewLayout`.

- [x] **Step 3: Verify**

Run: `node --experimental-strip-types --test src/api/search-id-query.test.ts`  
Run: `npm run build` and `npm run build:web`
