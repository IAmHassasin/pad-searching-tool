# Search: first-page paint + list virtualization (Approach A)

**Date:** 2026-09-13  
**Status:** Approved (user chose A)  
**Scope:** FE progressive fetch + virtualized results. LIKE / regexp / full-row JSON / client sort unchanged.

## Summary

Paint the first search page as soon as it returns, then keep fetching remaining matches in the background until `total`. Virtualize the results list so DOM cost is the viewport, not `min(2000, rows)`. Do **not** slim columns, do **not** replace LIKE, do **not** add global server sort.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Fetch model | Approach A: first page paints immediately; remaining pages load in background until all matches are in RAM |
| First page | `limit=80` |
| Later pages | `limit=5000` (API cap), `offset=loaded` |
| COUNT | First page only. Later pages send `skipCount=1` so regexp scan is not doubled. Client keeps `total` from the first response. |
| Sort / quick filter | Still client-side on the **accumulated** rows (same as today once fetch completes; partial while loading) |
| LIKE / regexp | Unchanged |
| Payload | Full rows unchanged |
| List DOM | `@tanstack/react-virtual`; drop `slice(0, 2000)` |
| Server `ORDER BY` | Not in this pass |

## Non-goals

- Slim list DTO / lookup-on-select
- Server sort for CD / awk-modified HP·ATK·RCV
- FTS / materializing `SOURCE_QUERY`
- Infinite-scroll-only (stop fetching when the user stops scrolling)

## §1 Progressive fetch

`searchAllMonsters` reports a snapshot after every page (`rows` so far, `total`, metadata). The UI renders `partial ?? query.data`. Changing filters clears `partial` so `placeholderData` can show the previous result until the new first page arrives.

## §2 skipCount

`GET /monsters/search?skipCount=1` skips `COUNT(*)` and returns `total: 0`. Only used when `offset > 0`. First page still counts.

## §3 Virtualization

`ResultsList` owns the scroll container (`h-full overflow-auto`). Parents become `overflow-hidden` + flex fill. Variable row height via `measureElement` (inline card preview). Overscan ~8. Sticky header stays outside the virtual body.

## Spec self-review

- [x] LIKE / regexp untouched
- [x] Approach A (not C infinite-scroll-only)
- [x] skipCount is hygiene for A, not the deferred “drop COUNT from the product”
