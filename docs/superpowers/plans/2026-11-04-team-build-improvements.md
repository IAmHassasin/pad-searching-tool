# Team build improvements — implementation plan (2026-11-04)

Branch: `improve/team-build`. Scope = the four requests below; nothing else is refactored.

## 0. Current state (verified by reading code)

| Area | Today |
|------|-------|
| Awakening stat multipliers | `web/src/lib/awakening-stat-modifier.ts` — one `switch` with hard-coded numbers, shared by search sort (HP/ATK/RCV awk modifier) and team build (`compute-stats.ts`, `super-awakening-modifier.ts`). No damage pipeline, no damage cap. |
| Team build | `web/src/team-build/TeamBuildPage.tsx` (807 lines). Slots are plain text ID inputs. State lives only in React (`useState`) — lost on reload. "Dungeon awk" button opens `AwkModifierModal` (stat="hp"). Totals: raw per slot; badge + LS box for team. ATK ignores badge/LS. |
| Search page | `App.tsx` → desktop 3 panels (`MonsterFilterPanel` left, `ResultsPanel`, `SkillFilterPanel` right) or `MobileWebviewLayout` (compact filter bar + results + bottom dock sheets). `ResultsList` rows: click = select; ⓘ = pinned `MonsterQuickPreview` popover. No context menu. |
| Tier maker | `tier-maker/CellEditor.tsx` "Card IDs" text input (`parseIdList`, Enter/Add). Board persisted in localStorage (`storage.ts`). |
| Routing | No SPA router: each tool is a full page load (`main.tsx`). Cross-page state must go through `localStorage`. |
| Dungeons | `dungeon-details` (AppMedia floor tables, 9 seeds) — no stat modifiers. `one-touch/catalog.json` is a static JSON catalog imported from GameWith (pattern to reuse). |
| Data | `seed/dadguide.sqlite` (2026-10). `awoken_skills.desc_en` is the newest source for awakening numbers (newer than the 2024-09 tweet). |
| Checks | No lint config. Type-check: `npx tsc -p web --noEmit`. Build: `npm run build:web`. Tests: `npm test` (explicit file list in root `package.json`, node `--test` + `--experimental-strip-types`). CI (`cd.yml`) runs `npm test`, `npm run build`, `npm run build:web`. |

## 1. Damage calc: shared module + latest numbers

**Goal:** one source of truth for awakening multipliers and a reusable damage pipeline (v20.4 sheet + 2024-09 awakening table + current DB text).

New files under `web/src/lib/damage/`:

1. `awakening-multipliers.ts`
   - `AWAKENING_MULTIPLIERS: Record<number, AwakeningMultiplierDef>` — per awoken id: `kind` (`stat` passive | `match` per-match shape | `subtotal` | `row` | `combo-enhance` | `orb-enhance` | `killer` | `fixed`), values, condition options (combo count, floor, HP side, player count), `source` string.
   - `getAwakeningStatMultipliers(id, settings)` re-implemented on top of the table. `awakening-stat-modifier.ts` keeps its public API (`computeMonsterStatMultipliers`, `withAwkEnabled`, `statMultiplierLabel`, `MODIFIER_AWAKENING_IDS`, …) and delegates to the table → search sort and team build keep working unchanged.
   - Value updates vs current code (DB text wins when it conflicts with the tweet; conflicts listed in the final report):
     - 57 / 58 HP≥50% / HP≤50%: ×2 → **×2.5**.
     - 72 Blessing of Poison Orbs: missing → **×2** (71 Jammers already ×2).
     - 43 Enhanced Combos: 7c ×2, 14c ×3 (DB; tweet says 2.5 — keep DB, note). 107: ×4 / ×9 (tweet 6.25 — keep DB, note).
     - 128 / 129 Yang / Yin: HP ×2, RCV ×2, ATK ×5 (DB; tweet says HP/RCV ×1.2 — keep DB, note).
     - Row enhance 22–26 (+30 % per row per awk), triple rows 116–120 (+90 %), attribute combo enhance 73–77 (+30 % per extra match, ≥2 matches), 121–125 (+60 %), enhanced orbs 14–18 (+6 % per enhanced orb, +7 % per awk on team) and 99–103 (+14 %), 45 bonus attack (fixed 1), 50 super bonus attack (×8, +10 M fixed): added as damage-pipeline entries (not stat passives).
     - Everything else already matches the tweet/DB (TPA 2.2/4.84, VDP 3.5/12.25, L 2.2/4.84, cross 3/9, T 8, L-heal 3, colour 2.5/4/5 and 6.25/16/25, blob 12, guard break 3, aging 1.5/2, multiboost 1.5, 127 ×1.5, 142 ×1.8, 132 ×1.25, 63 ×1.1, 138/139 ×3, 106 ×20, 143, 144 ×100, 145–147 ×1.5, 133–135 ×50, 141 ×50, killers ×5, column attacks 149–153 ×7).
2. `damage-calc.ts`
   - Constants `DAMAGE_CAP = 2_147_483_647`, `DAMAGE_CAP_EXPANDED = 4_294_967_294`, `capDamage(value, expanded)`.
   - `computeMatchDamage(match, ctx)` = ATK × (1 + 0.25 × (orbs − 3)) × orb-enhance × shape awakenings (TPA exactly 4 / VDP 3×3 / L / cross / T) × sub-attribute factor (1/3, 0.1 same) × skill multipliers.
   - `computeCardDamage(input)` = Σ match damage × row enhance × combo boost (7c/10c/15c) × blob × colour boost × attribute boost × HP% × L-shield × blessings × (1 + 0.25 × (combos − 1)) × leader skill → cap → × killer (×5 per matched awakening, ×2 per latent) × attribute advantage (×2 / ×0.5) − DEF → × enemy passive → cap. Returns a breakdown per step so UI can show it later.
   - Pure functions, no React; typed input so it can drive a future damage tab.
3. Tests: `awakening-multipliers.test.ts`, `damage-calc.test.ts` (cap, expanded cap, orb factor, shape stacking, combo boost thresholds, row enhance, killer/latent, attribute/def). Add to the `npm test` list in root `package.json`.
4. `docs/team-build-stat-modifiers.md`: new section "Damage pipeline + awakening table" with sources and the conflicts.

Out of scope: a damage-input UI (the module is the deliverable; the team page keeps showing stats).

## 2. Quick-search sidebar for ID fields (team build + tier maker)

New folder `web/src/components/quick-search/`:

1. `QuickSearchProvider.tsx` — context: `{ target, activate(target), deactivate(), expanded, setExpanded }`. A **target** = `{ id, label, onPick(monsterId) }` registered by an input.
2. `QuickSearchIdInput.tsx` — drop-in replacement for the ID `<input>`s: same props + `onPickId`. On focus/click it activates the sidebar for that field (sidebar expands); the input stays editable.
3. `QuickSearchSidebar.tsx` — always mounted on team build and tier maker:
   - Desktop (≥ 1280 px, same breakpoint as `useMobileWebview`): left column, collapsed rail (40 px, like `ResizableSidePanel`) ↔ expanded (360–480 px, resizable via `useResizablePanel({storageKey:"quick-search"})`).
   - Mobile: collapsed = floating rail button; expanded = left drawer (full height) using the mobile sheet styling (`animate-sheet-in`, `glass-bar`, safe-area padding).
   - Content = mobile-style compact UI: `MonsterActiveFilterChips` + `MonsterAwakeningFilter compact` + `MonsterMoreFiltersGroup compact` (= all of today's left sidebar: awakenings, rarity, attribute, type, stats, ID/name) + an **Active skill** section: `ActiveSkillCooldownField` + `SkillPatternGroup skillType="active_skill" iconOnly compact` (icon tags only = "main" active filters; pattern groups fetched with `fetchPatternGroups`).
   - Results: `searchAllMonsters` with debounced filters (300 ms); only runs when at least one filter / ID query is set (otherwise a hint). Rows rendered in the mobile *minimal* style (icon, NA/JP id, name) + ⓘ button → `MonsterResultPreviewFloating` (existing pinned preview). Click row → `target.onPick(id)` → field filled → sidebar collapses to the rail.
   - Header shows which field is being filled ("Filling: Sub 2 · Monster ID") and a Close button.
4. Wiring:
   - `TeamBuildPage`: Monster ID / Eq ID inputs → `QuickSearchIdInput`; page body wrapped in `QuickSearchProvider`, sidebar rendered left of the content (flex row).
   - `CellEditor` (tier maker): Card IDs input → `QuickSearchIdInput` with `onPickId` appending `id` to the current text (comma-separated, so multi-pick works).
   - `MonsterNameTranslationProvider` wrapped around both pages (needed by result rows).
5. Tests: `quick-search/fill-id.test.ts` (append/replace helpers), `search-active.test.ts` (has-any-filter rule).

## 3. Right-click / long-press on search results → slot picker → mini team preview

1. `web/src/lib/team-build/team-draft-storage.ts` — `loadTeamDraft()`, `saveTeamDraft(config)`, `setDraftSlot(config, slot, kind, id)`; key `pst.team-build.draft.v1`; sanitised parse (same style as tier-maker `storage.ts`). Also `subscribeTeamDraft` via the `storage` event.
2. `web/src/hooks/useTeamDraft.ts` — React state synced with the storage; used by the search page (mini preview) and `TeamBuildPage` (initial state + autosave). This is what makes "switch to the Team tab and the cards are still there" work across full page loads.
3. `web/src/components/team-draft/TeamSlotMenu.tsx` — context menu (desktop: positioned at pointer; mobile: bottom sheet) listing the slots: Leader, Sub 1–4, Helper, each with *Monster* and *Assist* actions (12 targets; the 10 "own" ones = leader + 4 subs × monster/assist, helper pair shown last — assumption, see report). Shows the current occupant icon if any.
4. `ResultsList`: `onContextMenu` (desktop) and long-press (pointer down ≥ 450 ms without > 8 px movement, touch/pen) on a row open `TeamSlotMenu` for that monster; native context menu suppressed on touch.
5. `web/src/components/team-draft/TeamDraftDock.tsx` — mini preview rendered on the search page (desktop: bottom-left floating card above the results; mobile: a collapsible strip above the filter dock): 6 slots with portrait + assist mini icon + id, buttons *Open Team Build* (`/team-build`), *Clear*. Hidden until the draft has at least one card.
6. `TeamBuildPage`: initialise from draft (fallback `defaultTeamBuildConfig`), autosave on every config change (debounced 200 ms), "Reset team" action.
7. Tests: `team-draft-storage.test.ts` (round-trip, sanitising, slot set/clear).

## 4. Dungeon list with stat modifiers (replaces "Dungeon awk")

1. `web/src/lib/team-build/dungeon-catalog.json` + `dungeon-catalog.ts` — static catalog built from GameWith / AppMedia research (sources recorded per entry): `{ id, nameJa, nameEn, sourceUrl, sun, moon, multiplayer, maxFloor, stat: { hp, atk, rcv } (multipliers), superGravity?, notes }`. Includes a `custom` entry with user-editable multipliers and sun/moon toggles.
2. `TeamBuildConfig` gains `dungeonId: string` and `customDungeon` (`{hp, atk, rcv, sun, moon}`). `defaultTeamBuildConfig` → `dungeonId: "none"`.
3. `web/src/lib/team-build/dungeon-modifiers.ts` — `resolveDungeonModifiers(config)` → `{ stat: {hp,atk,rcv}, awkSettings }`: derives the awk settings from the dungeon (moon → 129, sun → 128, multiplayer → 30, maxFloor ≥ 10 → 130 B10, ≥ 5 → B5) on top of the user's manual awk selection.
4. `compute-stats.ts`: new breakdown stage `afterDungeon` (badge → LS → dungeon stat multiplier) for HP/ATK/RCV; team totals use it. Raw slot stats unchanged.
5. UI: header button "Dungeon awk" → **"Dungeon"** opening `DungeonPickerModal` (search box, list grouped by effect, chips: ☀ / 🌙 / ATK ×, RCV ×, HP ×, multi). The modal keeps an *Advanced awakenings* link that opens the existing `AwkModifierModal`, so manual awk toggles remain reachable. Team settings card shows the selected dungeon + its modifiers; the totals box becomes "With badge + LS + dungeon".
6. Badges: cross-check `BADGE_TEAM_PCT` against the GameWith badge page; add any missing team-wide HP/RCV/ATK badges found by research.
7. Tests: `dungeon-modifiers.test.ts`, extend `compute-stats` coverage (`compute-stats.test.ts`) for the dungeon stage.

## 4b. Team page layout (added 2026-11-04 after review with PDC)

- Left: quick-search sidebar always open on desktop; clicking a slot card selects it and targets its Monster ID (mobile only sets the target, the 🔍 button opens the drawer).
- Centre: slot row → totals → collapsible "Team IDs · import / export" → in-game style card (`TeamCardSheet`: portrait, awakenings, HP/ATK/RCV with +points, Lv / Max Lv, cost, card + assist active skills, leader skill, assist stats block) → numeric editor (IDs, level, +points, assist +points).
- Right: `TeamAwakeningPanel` — card awakenings with stat-affecting ones highlighted (green = active, red = condition unmet), super-awakening swap, awakenings granted by the assist, and the full list of stat contributions (`lib/team-build/stat-contributions.ts`), plus slot stats. Inline under the card on mobile.
- Numbers verified against PDC: per-slot = PDC ステ, totals = PDC PT情報 (badge + Enhanced Team HP/RCV from cards and assists).

## 5. Verification

- `npx tsc -p web --noEmit`, `npm run build:web`, `npm test` (with the new test files registered).
- Dev smoke run (`npm run dev:web` against the local API) with Playwright screenshots of: quick-search on team build + tier maker, context menu + dock on search, dungeon modal → totals change. Reported honestly if the API/DB is not available locally.
- Review via `dss-code-review` on the diff.

## 6. Risks / assumptions

- Awakening numbers: DB text (2026-10) is treated as newest; tweet (2024-09) conflicts are listed, not silently applied.
- "10 slots incl. assist": implemented as leader + 4 subs × (monster, assist) = 10, plus the helper pair for completeness.
- Dungeon catalog is a static JSON (like one-touch); refreshing it is a manual re-import, no admin sync in this change.
- No commit/push in this task (git identity is a non-dssolution.jp email → would fail the commit identity control).
