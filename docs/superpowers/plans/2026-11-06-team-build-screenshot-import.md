# Team build: import a team from an in-game screenshot — feasibility + plan (2026-11-06)

> Status (2026-11-06): phase 1 implemented on branch `feat/team-screenshot-import`
> (`web/src/lib/team-build/screenshot/`, `ScreenshotImportModal.tsx`, `scripts/build-icon-index.ts`).
> Deviation from 4.1: the frame-edge row search alone was not enough — the icon art sits inside the
> frame with a ~6 px offset and is ~150 px, not 162 px — so the layout keeps separate frame/icon
> geometry and each box is aligned by correlation against its top candidates (`alignBoxToCandidates`).
> With that, the sample screenshot scores 0.92–0.93 on all five big cards and 0.86 on the helper.
>
> Update (2026-11-06, second screenshot): cards wearing the two large awakening/star badges in the
> top-right corner scored ~0.6 and matched nothing. The five big cards now compare only
> `TEAM_CARD_CELLS` (top 10 rows minus the top-left attribute orb and the badge area, 84 of 160
> cells); the helper and the assist inlays keep every cell. Index format unchanged. Both sample
> screenshots now match (0.94–0.96 and 0.90–0.96).
>
> Preselection rule (changed on request): the best candidate is ticked whenever it scores ≥ 0.75,
> with no runner-up gap requirement; a ticked candidate below 0.90 gets a blinking red outline so
> the user double-checks it (an icon and its "(Reward)" twin tie, for example).
>
> Third screenshot (Team 3/18): three slots show the same card (13922, Kali) whose CDN icon has a
> different framing/background than the in-game card, so it tops out at ~0.77. Two slots and the
> helper missed it because their per-slot alignment drifted towards wrong candidates. Now a card
> whose alignment lands on nothing ≥ 0.75 takes the median shift of the strong cards (shared row
> geometry); a weak helper is aligned to the ids confirmed on the cards; and the confirmed ids are
> scored on every slot and merged into its candidate list (duplicate subs, helper = own leader).
> Helper geometry re-measured (x 0.8512, size 0.1012, dy −0.1667). Result on the three samples:
> 18/18 top-1, 18/18 preselected (the three 13922 slots at 0.76–0.77 are flagged for review).

Input: a phone screenshot of PAD's **Edit Team** screen (EN client, 1008×2244 in the sample).
Output: a `TeamBuildConfig` draft (6 slots: leader · 4 subs · helper, plus assists where
recognisable) loaded into the team-build page, with a confirmation step before it replaces the
current draft.

## 0. Current state (verified by reading code)

| Area | Today |
|------|-------|
| Import path | `web/src/lib/team-build/team-import-export.ts` — text only (line 1 monster IDs, line 2 eq IDs). UI: "Team IDs · import / export" section in `TeamBuildPage.tsx` (~line 885). Draft persisted in `localStorage` key `pst.team-build.draft.v1`. |
| Monster data | `seed/dadguide.sqlite`: 14,615 monsters (max id 62242). `rarity`, `cost`, `leader_skill_name_en`, `collab_id` are all queryable; `/api/monsters/search` already filters by rarity and skill text, `/api/monsters/lookup?ids=` returns up to 50 cards. |
| Icons | CDN `${VITE_PAD_CDN_ORIGIN}/icons/<id zero-padded 5>.png`, 100×100 PNG with the attribute frame baked in, `Access-Control-Allow-Origin: *` (so a browser `<canvas>` can read pixels). Helper: `web/src/lib/portraits.ts` → `iconUrl()`. |
| Image libs | None in root or `web/` (no sharp / jimp / tesseract). Browser Canvas is available; the Android build is a Capacitor WebView (same code). |
| Stats pipeline | `compute-stats.ts` is verified against PDC/in-game cards (`pdc-reference.test.ts`), so computed team totals can be compared with the totals printed on the screenshot. |
| LLM usage | None in the repo today. No API keys in env. |

## 1. Feasibility verdict

**Feasible, with one hard part (locating the cards) and one soft part (assists).** The core step —
turning a cropped card icon into a monster id — was probed on the real screenshot and works without
any ML or external API:

Probe (scratchpad, `jimp`, no repo changes): crop the 6 icon boxes by hand, grey-scale 16×16 of the
**top 60 %** of each box (the bottom 40 % is covered by the assist inlay and +297 badges), Pearson
correlation against the same descriptor of CDN icons.

| Slot | Top-1 (pool = all 14,613 DB icons) | Score / runner-up | Correct? |
|------|-------------------------------------|-------------------|----------|
| Leader | 12960 Isao Shinomiya | 0.80 / 0.75 | ✔ (rarity 9, cost 40, LS name matches DB) |
| Sub 1 | 12932 Iharu Furuhashi | 0.78 / 0.65 | ✔ (rarity 7, cost 30) |
| Sub 2 | 12909 Kikoru Shinomiya & Kaiju No. 8 | 0.84 / 0.62 | ✔ (rarity 9, cost 40) |
| Sub 3 | 13444 Sein (Frieren collab) | 0.84 / 0.74 | ✔ (rarity 5, cost 15) |
| Sub 4 | 12930 Kikoru Shinomiya | 0.86 / 0.70 | ✔ (rarity 7, cost 30) |
| Helper (80 px thumbnail) | 12930 Kikoru Shinomiya | 0.70 / 0.69 | ✔ but the margin is too thin to trust without confirmation |

Using the whole card instead of the top 60 % drops to 5/6 (helper wrong); the occlusion mask matters.

Independent text check: `leader_skills.name_en LIKE '%Strongest Man%'` → exactly one monster
(12960), so the leader-skill line on the screenshot alone identifies the leader.

What the probe does **not** cover: automatic box detection (boxes were measured by hand), assist
inlays (≈54 px, partially occluded, no ground truth), and other layouts (JP client, team list,
dungeon result screen).

## 2. What the screenshot can and cannot give

| `TeamBuildConfig` field | Source on screenshot | Confidence |
|---|---|---|
| `members[i].monsterId` (6) | icon art → hash match (+ rarity/cost text as filter) | high for the 5 big cards, medium for the helper thumbnail |
| `members[i].eqId` | small inlay bottom-left of each card | low–medium; always show as "suggested", never silently accept |
| `members[i].level` | "Lv.120" text per card | high if OCR/vision is used; else default 120 |
| `plus*` | not shown (star badge ≈ +297) | assume 99/99/99 (current default) |
| `selectedSuperAwakening`, latents | not shown | leave null |
| `badge` | small icon top-left of the team panel (≈20 badge sprites) | medium; template-match against the badge sprite set |
| `dungeonId`, `awkSettings`, `leaderOverrides` | not on screen | keep current values |
| Cross-check | Total HP / ATK / RCV, Total Rarity, Lv, Cost, Rare | used only to validate/rank candidates |

Hard constraints: evolutions that reuse the same art (e.g. 12903 and its "(Reward)" copy 12959)
tie on pixels and can only be separated by rarity/cost/user choice → the confirm step is mandatory.

## 3. Architecture options

### A. Local pixel matching (no network beyond the CDN, no API key) — **recommended for phase 1**

1. Offline: `scripts/build-icon-index.mjs` downloads every icon listed in the DB from the CDN once,
   computes the descriptor (16×10 grey of the top 60 % + 64-bit dHash), writes
   `web/public/icon-index.bin` (≈2.3 MB raw, ~1 MB gzipped; lazily fetched only when the feature is
   opened). Regenerate with the DB (`make` target next to `dungeon-max-hits`).
2. Browser: user picks/pastes/drops a screenshot → `<canvas>` → locate the 6 card boxes → descriptor
   per box → rank the index → top-5 per slot with scores.
3. Confirm UI: a modal with one row per slot (crop thumbnail, top candidates with name/rarity/cost,
   "none"), assists as suggestions, then "Apply to team". Totals from `computeTeamStats` are shown
   next to the screenshot's totals when the user types them (or when OCR is available).

Pros: deterministic, offline, zero per-use cost, works in the Android WebView. Cons: layout
detection must be written by hand; no text reading without an OCR library.

### B. Claude vision for the text fields — optional phase 2

Send the screenshot to `claude-opus-5-5` through a small NestJS proxy and ask for structured JSON
(`output_config.format`): per-card `level`, `cost`, `rarity`, leader-skill name/text, totals, badge
description. Rough cost: a 1008×2244 image ≈ 3k input tokens → about $0.02 per screenshot at $4/MTok
input; negligible output. The model reads stylised game text reliably; it is **not** a substitute
for id matching (it cannot map icon art to a monster id), so A stays the backbone.

Requirements before this can ship: API key in server env only (never in the web bundle), rate limit
on the proxy, cost cap, and human review (org rule: auth/infra changes). Alternative without an
LLM: `tesseract.js` in the browser (~10 MB of wasm + language data, accuracy on the PAD font
unverified).

### C. Fully LLM-driven (vision returns monster ids) — rejected

Vision models name well-known characters but cannot return reliable PAD monster ids for 14k cards and
their evolutions; false confidence would be worse than a ranked list.

## 4. Implementation plan (phase 1 = option A)

### 4.1 Spike (½–1 day) — settle the two unknowns before writing UI

- Box detection: implement the "Edit Team" layout profile (all x positions are fractions of image
  width; y anchor found by scanning for the row of five same-size framed squares: 1-D profile of
  high-saturation pixels + equal-spacing check). Validate on 3–5 screenshots from different devices /
  aspect ratios (letterboxing moves the panel vertically). Fallback if detection fails: user drags
  one box over the leader, the other five are derived from the profile.
- Per-box refinement: search ±8 px offset and ±5 % scale for the best correlation against the top
  candidates (cheap: a few hundred comparisons).
- Full-pool precision (section 7) decides whether a rarity/cost filter is needed in phase 1 or can
  wait for phase 2.

### 4.2 Index build

- `scripts/build-icon-index.mjs` (node, `better-sqlite3` for the id list, `jimp` as a dev
  dependency, CDN origin from env). Output: header + `Uint8Array` descriptors + id table.
- Incremental: the script reads the existing index and only downloads icons for ids that are not in
  it yet (tens of requests per DB update, 14.6k only on the very first build). It runs on the dev
  machine or in CI, never on the app server, and the browser never fetches icons for matching —
  it loads the index file once (served as a static asset, cacheable) plus the handful of candidate
  thumbnails the confirm modal shows, which the team page already requests today.
- Unit test: descriptor function is shared with the browser (pure TS under
  `web/src/lib/team-build/screenshot/descriptor.ts`, imported with `.ts` extension so `node --test`
  can run it), test on a fixture icon and on a synthetic shifted copy.

### 4.3 Browser pipeline (`web/src/lib/team-build/screenshot/`)

- `layout.ts` — layout profiles (`edit-team-en` first; JP later), box detection, refinement.
- `descriptor.ts` — canvas → grey top-60 % vector + dHash (same code as the build script).
- `match.ts` — load `icon-index.bin` (lazy, cached), rank, return `{ slot, candidates[] }`.
- `apply.ts` — candidates + user choices → `TeamMemberConfig[]` (reuse `importTeamIdString` shape;
  keeps role/level/plus from the current draft).
- Tests for `layout.ts` (fixture screenshot downscaled, expected boxes) and `match.ts` (fixture
  index with ~20 icons, expected top-1 for the 5 big cards of the sample screenshot).

### 4.4 UI

- New button "Import from screenshot" in the "Team IDs · import / export" section (file input +
  paste handler; on Android the file input opens the gallery).
- `ScreenshotImportModal.tsx`: progress → per-slot candidate rows → assists as "suggested" → apply.
  Shows the computed team totals so the user can eyeball them against the screenshot.
- Nothing is written to the draft until "Apply".

### 4.5 Done criteria

- Sample screenshot: 5 big cards resolved top-1 automatically, helper resolved or offered as top-3,
  assists offered as suggestions, apply yields the same ids as the manual team.
- `npm test`, `npm run build:web` pass; feature-flag not needed (the button is harmless).

## 5. Phase 2 (optional): text reading

Either Claude vision (option B) or `tesseract.js`. Adds: auto level per card, rarity/cost filter for
candidates, leader auto-resolve by leader-skill name, automatic totals check, badge from description.
Requires the proxy/key/rate-limit work and a review before deploy.

## 6. Risks and unknowns

| Risk | Impact | Mitigation |
|------|--------|------------|
| Card boxes not found on some devices / screens | feature unusable on that screenshot | layout profiles per screen, manual drag fallback, refinement step |
| Same-art evolutions tie | wrong evo picked silently | always confirm; prefer the candidate whose rarity/cost (when known) matches; show all tied ids |
| Assist inlays too small/occluded | wrong eq id | mark as suggestion only; never auto-apply |
| CDN icon set lags the DB (new cards) | new cards unmatched | index build logs missing ids; "none" option in UI |
| Index size on mobile data | 1–2 MB download | lazy load + `Cache-Control`; ship as part of the static bundle |
| JP client / other screens | not supported in phase 1 | explicit scope note in the UI |
| Phase 2 API key and cost | security/infra | server-side only, rate limit, human review |

## 7. Probe notes (for whoever implements 4.1–4.2)

- Pool: every `monster_id > 1` in `seed/dadguide.sqlite` (14,614 ids); 14,613 icons exist on the
  CDN. File names must be zero-padded to 5 digits (`00123.png`), as `portraits.ts` already does.
- Descriptor: box → top 60 % → 16×16 grey (nearest-neighbour resize) → Pearson correlation. dHash
  (64-bit) was computed too but is a weaker ranker here; keep it only as a cheap pre-filter.
- Scores: correct id 0.78–0.86 for the five big cards with a runner-up gap of 0.05–0.22; the helper
  thumbnail scores 0.70 with a 0.01 gap. Thresholds for the UI: ≥0.75 and gap ≥0.05 → preselect;
  otherwise show top-5 unselected.
- Boxes were measured by hand on the sample (1008 px wide): leader x≈56, subs x≈289/457/627/797,
  width ≈162 px, y≈890; helper 90 px at x≈862, y≈728. Automatic detection is not probed.
- Probe runtime: ranking 6 crops against 14.6k descriptors is instant; loading PNGs dominated.
