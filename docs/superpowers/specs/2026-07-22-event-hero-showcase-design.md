# Event detail: Steam banner + art showcase cards

**Date:** 2026-07-22  
**Status:** Implementing  
**Scope:** Frontend — `EventHero`, `EventMonsterCard`, `EventDetailPage`

## Problem

The adaptive large-art showcase was mistakenly applied to the hero. The intended split is:

1. **Top banner** — Steam-style key art composition (all cover monsters + event name)
2. **Cards below** — large art + monster name only (no New / rarity / note)

## Banner (EventHero)

- Wide banner (~16:6–16:7), simple dark/gold gradient background
- Event **title** on the left (or readable over safe area)
- All `coverMonsters` composed on the right: overlapping, bottom-cropped, Steam capsule style
- **Only** art + event title (no subtitle)

## Cards (EventMonsterCard)

- Single flat grid (no section headings)
- Each card: optional `label` badge + art + monster name
- Art uses natural height (`h-auto`) — no tall empty letterbox above the portrait
- Seed/API: flat `entries` with per-entry `label` (legacy `sections` still accepted and flattened)

## Non-goals

- List page redesign
- API / seed changes
- Modal changes

## Touchpoints

- `web/src/event/EventHero.tsx`
- `web/src/event/EventMonsterCard.tsx`
- `web/src/event/EventDetailPage.tsx`
