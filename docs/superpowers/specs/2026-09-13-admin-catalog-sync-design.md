# Admin: auto-fetch new events and dungeons

**Date:** 2026-09-13  
**Status:** Approved (architecture, dungeon flow, event flow, errors/UI/tests)  
**Approach:** Two admin POST endpoints write seed JSON immediately (same pattern as Refresh DB)

## Summary

Superadmin can check AppMedia and PAD US News for catalog updates and apply them without a preview step. New dungeon guides are imported into dungeon seed JSON. New event names from Evolutions & Upgrades articles get a seed page pointing at the related news URL, with cards filled from Assist Evolution names matched to the working SQLite (same seed shape as hand-curated events). Empty stubs are filled on a later sync; events that already have cards are skipped.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Persistence | Write `dungeon-details/seed/dungeons/<id>.json` and `event/seed/events/<id>.json` (not SQLite catalog tables) |
| Admin UX | Two buttons: Check for new dungeons / Check for new events; confirm then run; no diff preview |
| Dungeon sources | AppMedia homepage sidebar **ゲリラダンジョン** + **ステージダンジョン** only |
| Dungeon “new” | `appmediaPostId` **greater than** max id already in dungeon seed (currently 80128597) |
| Event source | [PAD US News](https://www.puzzleanddragons.us/news) articles titled **New Evolutions & Upgrades!** |
| Event name | `Select {EVENT} (monsters\|characters) have received upgrades as well!` |
| Event write | Create/fill a seed from Assist Evolution names → monster ids; **skip** if a seed already has cards (do not merge) |
| Event URL | Use the sibling news post (`{slug}-event-…`), not the upgrades article and not Godfest |
| Job lock | One admin job at a time (shared with Refresh DB) → 409 if overlapping |

## Non-goals

- 降臨ダンジョン, ランキング, 最新高難度 (unless the URL also appears in the two sidebar sections)
- Backfilling dungeon ids ≤ cutoff
- Re-importing dungeons already on disk
- Importing every news post (Godfest, patch notes, etc.)
- Replacing hand-curated event notes/labels/covers

---

## §1 Admin API / UI

- `POST /admin/refresh-dungeons` (Bearer, AdminAuthGuard)
- `POST /admin/refresh-events` (Bearer, AdminAuthGuard)
- Shared in-progress flag with `POST /admin/refresh-db`
- Response includes `ok`, `finishedAt`, and per-feature counts (`added` / `created` / `skippedExisting` / `failed` / `unparsedArticles`)
- Empty update is still 200 (`No new dungeons.` / `No new events.`)
- Source fetch failure: do not write partial catalog from a missing homepage/news document; return error
- Per-item import failure: keep successful writes; list failures in the response

## §2 Dungeon sync

1. `GET https://appmedia.jp/pazudora` (UA `pad-searching-tool/catalog-sync`)
2. Parse `nav.nav_left_menu` whose `div.ac2` is `ダンジョン攻略`
3. Collect `/pazudora/{id}` links under `leftmenu_title` **ゲリラダンジョン** and **ステージダンジョン**
4. Strip HTML comments before collecting links
5. Skip index pages (link text contains `一覧`, known ids such as ゲリラ一覧 / その他ステージ一覧)
6. `cutoff = max(existing seed appmediaPostId)`; keep `id > cutoff` and not already on disk
7. Import each remaining id with the existing AppMedia dungeon pipeline (WP fetch → floors/gimmicks → `titleEn` → JSON)
8. Append the URL to `dungeon-details/seed/dungeon-urls.txt` when import succeeds

## §3 Event sync

1. `GET https://www.puzzleanddragons.us/news` (page 1)
2. Collect `/single-post/new-evolutions-upgrades…` article URLs
3. Fetch each article; require the Select-upgrades sentence; otherwise `unparsedArticles++`
4. Match `{EVENT}` to existing seeds via normalized tokens (`returns` / trailing `YYMM` stripped; slugify also compared to `eventId`)
5. **Existing event with cards:** skip (do not parse monsters or rewrite the seed)
6. **New or empty stub:** find a sibling `/single-post/` URL on the same news page whose slug contains the event slug, preferring `{slug}-event`, excluding `godfest` and `new-evolutions-upgrades`
7. Match `{EVENT}` to a dadguide collab/series `group_id`. Write `{slug}.json` with that `groupId` plus Assist Evolution ids as **badge marks** (`New Monster` / `New Evolution`). Showcase at read time is the full group; unmarked members have no new-card badge.

## §4 Tests

CI uses HTML/text fixtures (no live AppMedia/PAD US):

- Sidebar parse: guerrilla + stage ids, ignore comments, skip 一覧, filter `id > cutoff`
- Event regex + normalize match against GungHo seed
- Related event URL prefers `{slug}-event`, skips Godfest and upgrades
- New event writes cards from Assist Evolution names; existing events with cards are skipped (not merged); empty stubs are filled
