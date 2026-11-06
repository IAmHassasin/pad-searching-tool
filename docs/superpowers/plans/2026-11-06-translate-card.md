# Translate: JP monster-detail screenshot → English card — feasibility + plan (2026-11-06)

> Rev 2 (2026-11-06, after user decisions): **no budget → free libraries only**. Text reading uses
> `tesseract.js` in the browser plus the repo's existing `google-translate-api-x` service and the
> DB's JP/EN skill corpus. The earlier Claude-vision option is dropped (kept in §3C for the record).
> User decisions: (1) show stats, level and +99 as on the screenshot, and add them to the card;
> (2) prefer CDN art/icon when the CDN has them, crop from the screenshot otherwise; (3) show only the
> max-level cooldown (`ターン:N`); (4) English name large, Japanese name smaller underneath;
> (5) no paid APIs.

Input: a phone screenshot of the **JP client monster detail screen** (sample set: 4 images,
1242×2200, cards No.14280 / 14301 / 14302 / 14303).
Output: an English detail card as PNG (and on screen):

- **Known card** (the number maps to a row in our DB and the character art matches) → render the
  existing `MonsterDetailCard` from DB data with CDN art/icon. No OCR, no translation needed.
- **New card** (not in DB, or the art does not match) → prefill a **Custom Card** draft: art and
  icon from the CDN when available (else cut from the screenshot), Japanese name/skill text read by
  OCR and translated to English, then the user reviews in the Custom Card editor and downloads
  the PNG.

## 0. Current state (verified by reading code / probing, 2026-11-06)

| Area | Today |
|------|-------|
| DB | `seed/dadguide.sqlite`, 14,615 monsters. `monster_no_jp == monster_id` for **every** row (diff count 0), so the `No.XXXXX` printed on the JP screen is our `monster_id` directly. `name_ja`, `active_skills.desc_ja/desc_en` (9,013 skills, all have `desc_ja`), `leader_skills.desc_ja/desc_en`, `awoken_skills.name_ja/desc_ja` exist → a ready-made JP→EN parallel corpus for PAD wording. |
| Sample cards | **None of the 4 sample ids is in the DB** (14280, 14301–14303 are newer than the seed). The "new card" path is therefore the common case for fresh JP collabs; the "known card" path covers everything already synced. |
| CDN | `portraits/<id>.png` → **200 for all 4 sample ids** (250–475 KB). `icons/<id>.png` → **403 for all 4** (icon set lags the portrait set). Both exist for older ids (12984, 13724). CORS is `*`. |
| Icon matching | `web/src/lib/team-build/screenshot/` already has the descriptor (16×16 grey, Pearson), `icon-index.bin` for all DB ids, `descriptorForId()`, `rankIconCandidates()`, canvas decode/crop helpers. Reusable as-is for "double check the character image". |
| Custom card | `/custom-card`: `CustomCardDraft` (name, number, rarity, attrs, types, awakenings, SA/sync, AS/LS text + CDs, HP/ATK/RCV, art blob + 2:3 crop, icon blob), `MonsterDetailCard` preview, `exportElementToPng`. Session-only state; no "load a draft" entry point yet. No level / plus / cost / JP-name fields. |
| Translation | Server already depends on `google-translate-api-x` (free, unofficial): `NameTranslationService`, `POST /monsters/translate-names` (ids only), `translateLabels()` (free text, batch, cache, single upstream queue). |
| OCR | None in the repo. `tesseract.js` probed in the scratchpad (see §1). |
| Awakening sprites | `web/src/assets/pad/awakenings/sprite.webp`, 31×32 tiles, 10 columns × 16 rows (154 icons), id = tile index. Usable as templates. Orb sprites: `web/src/lib/orb-sprite.ts`. |

## 1. Feasibility verdict

**Feasible with free tools, with a mandatory review step.** Two independent problems:

1. **Identification + known-card render** — pure client, deterministic: read the card number,
   compare the bottom-left thumbnail with the CDN icon descriptor of that id, render from DB.
   Confidence high (same machinery as the team screenshot import; the thumbnail here is ~195 px,
   un-occluded, and the id is known so it is a 1:1 check, not a 1:14,615 search).
2. **Reading and translating Japanese text** — `tesseract.js` (jpn+eng) + preprocessing, probed on
   samples 1 and 4 (node, 2× upscale, inverted grey / "bright-or-vivid pixel" binarisation,
   per-box page-segmentation mode):

| Box | Probe result | Verdict |
|---|---|---|
| `No.14301` / `No.14280` | exact (conf 90 / 19, digits whitelist) | OK with voting over 2 preprocessings; digit templates as backup |
| Name `転生ポチャッコ` | exact | OK |
| Name `クロミとバク` | `タロミンバタケタ` | **fails** on this font/kerning → name needs DB fuzzy match or manual edit |
| HP/ATK/RCV `48,389 / 29,987 / 5,456` | `4838 / 2997 / 5.456` (comma / digit drops) | **unreliable** → use **digit template matching** (PAD digit font is fixed, white on dark) instead of tesseract for every number |
| `Lv.120 / 最大Lv.120 / コスト 30` | `Lu.120 / 最大Lu.120 / 30` | numbers OK after templates; labels are fixed positions anyway |
| AS name + `ターン:5` | `より道お散歩のちから … ター:5` | OK (turns via digit templates) |
| AS desc, sample 1 (no inline icons) | `2ターンのの間、ダメージ吸収と属性吸収を無効化、自分の ダメージ上限値が350億。バトル6以降のの場合、効果が2倍。` | **near exact** (doubled `の` only) |
| AS desc, sample 4 line with inline icons (`🔒を解除し、🟢🟣💗を10個ずつ生成`) | `HEMRL, COwENETHYER. ZFI/ILHEIL.` | **fails** → inline icons must be detected and masked before OCR, then re-inserted as words |
| LS desc, sample 1 | `火回復人の同時攻撃ゼでダメージをB2%軽減。国発動て 攻撃力が120倍、4コンボ加算、固定10OO万ダメージ。` | usable: `82%`→`B2%`, `1000`→`10OO`, `の`→`人の`, the inline combo icon → `国` |

Conclusions that shape the design:

- Numbers come from **template matching** against the PAD digit glyphs (10 digits + `,` `+` `(` `)`
  `%` `.`), not from tesseract. Deterministic and exact on binarised crops.
- Inline icons in skill text (orbs, lock, awakening badges, `【落ちコンなし】`-style tags) are
  **detected first** (template match against the orb/awakening sprites inside the text panel),
  painted out, and the OCR word boxes are merged with the icon boxes in x-order so the JP string
  becomes e.g. `[lock]を解除し、[wood][dark][heart]を10個ずつ生成`.
- The OCR'd JP text is **corrected against the DB corpus** before translation: fuzzy match
  (character trigram similarity with digits normalised) against all `desc_ja`; a hit ≥ 0.92 replaces
  the OCR text with the clean DB text **and** gives the dadguide `desc_en` directly (numbers
  substituted) — no machine translation at all for reused skills. PAD skill text is formulaic
  enough that this will cover a large share of leader skills and many actives (share to be measured
  in the spike).
- Everything else goes through the existing google-translate path with a PAD glossary applied
  before (JP term → placeholder) and after (placeholder → dadguide wording), e.g. `落ちコンなし` →
  `[No skyfall]`, `固定N万ダメージ` → `deals N×10,000 fixed damage`, `ダメージ上限値` → `damage cap`,
  `ごくい` kept in romaji. Google output is a draft; the review UI shows JP source next to every
  English field.
- OCR runs on the phone/PC in a worker; first use downloads the tesseract core (~4 MB wasm) and the
  `jpn` language data (a few MB, served from jsDelivr by default — self-host under `web/public/` so
  the Android build does not depend on a third-party CDN; exact size to be confirmed in the spike).

What the screenshot gives (JP detail screen, measured on the 1242×2200 samples; fractions of
W/H, to be re-measured in the spike on more devices):

| Field | Where on screen | How to read |
|---|---|---|
| Number `No.14301` | header, x 0.16–0.42 W, y 0.01–0.03 H | digit templates (tesseract as cross-check) |
| Name (JP) | header, y 0.03–0.05 H | tesseract → fuzzy match against `name_ja` (known cards) → google-translate + `titleCaseTranslatedName` (new cards) |
| Rarity | ★ row, x 0.42–0.70 W, y 0.015–0.03 H | count gold star blobs |
| Types (1–2) | row at y ≈ 0.08 H, icon + JP label | JP label dictionary → type id (バランス=1, 体力=2, 回復=3, ドラゴン=4, 神=5, 攻撃=6, 悪魔=7, マシン=8, 進化用=0, 覚醒用=12, 強化合成用=14, 売却用=15); the type icon can be template-matched too |
| Full art | centre, y ≈ 0.15–0.58 H | **CDN portrait when `portraits/<id>.png` → 200** (decision 2); else crop box → `ArtCropModal` |
| Super awakening (equipped) | single icon left of the column top, x ≈ 0.86 W, y ≈ 0.16 H | sprite template match |
| Awakenings (up to 9) | right column, x ≈ 0.93–0.97 W, y 0.16–0.55 H, pitch ≈ 0.043 H | sprite template match (RGB 12×12 correlation against the 154 tiles) |
| Thumbnail icon | stats panel, x 0.02–0.18 W, y 0.685–0.77 H (~195 px) | **CDN icon when 200**, else crop; descriptor → id double check; attribute orbs at its corners → attribute 1/2 |
| HP / 攻撃 / 回復 + `(+99)` | stats panel | digit templates; keep raw values **and** the plus flag; shown on the card as on the screenshot (decision 1) |
| `Lv.120 / 最大Lv.120`, `コスト 30` | stats panel | digit templates; shown on the card (decision 1) |
| Active skill: name, `Lv.最大 ターン:N`, body | スキル / 進化スキル panel | tesseract (+ icon masking) → corpus match or translate; `N` shown as the only cooldown (decision 3) |
| Leader skill: name, body | リーダースキル panel | same |

Not on screen: Lv 99 base stats, skill Lv 1 cooldown, inheritable flag, collab id, evolution tree,
latent slots.

## 2. Pipeline

```
screenshot (file / paste / drop, batch OK)
  │  decode → RgbaImage (existing browser.ts), downscale once to ≤ 1300 px wide
  ├─ layout.detectJpDetailLayout()  → boxes: header, stars, type row, art, SA, awk column, thumb, stats, AS, LS
  ├─ digits.read(number, hp, atk, rcv, plus, lv, maxLv, cost, turns)      (template matching, sync)
  ├─ thumb crop → descriptor; corr(thumb, descriptorForId(number)); rankIconCandidates(thumb)
  ├─ identify(): number ∈ DB and corr ≥ 0.85                         → KNOWN(number)
  │              number ∉ DB (or unreadable) and top-1 score ≥ 0.92  → KNOWN(top-1), flag "number differs"
  │              otherwise                                           → NEW
  │
KNOWN → GET /monsters/lookup?ids=N → MonsterDetailCard (CDN art/icon) + screenshot stats/level line → PNG
NEW   → ocr (worker): name, AS name/desc, LS name/desc  (inline icons masked + re-inserted as tokens)
      → correct: corpus fuzzy match (desc_ja) → reuse desc_en, or POST /translate/labels (google) + glossary
      → pixel: rarity, types, attrs, awakenings + SA
      → art/icon: HEAD CDN portrait & icon → use when 200, else crop
      → CustomCardDraft (+ nameJa, level, maxLevel, plus, cost) → open /custom-card → review → Download PNG
```

Every automatically read value carries a confidence flag; the review step shows the JP OCR text
(editable) next to each English field; re-translate on edit.

## 3. Architecture options for text reading

### A. `tesseract.js` + digit templates + DB corpus + google-translate — **chosen (free)**

- Client: `tesseract.js` (Apache-2.0) in a web worker, languages `jpn`+`eng`, lazy-loaded on the
  first NEW card; core + traineddata self-hosted under `web/public/translate/` (also works in the
  Capacitor WebView). Digit templates are a small PNG set built from the sample screenshots
  (`scripts/build-digit-templates.ts`) and committed.
- Server: reuse `NameTranslationService.translateLabels()` behind a new `POST /translate/labels`
  (free text, max 10 strings × 300 chars, same queue + cache). Add a corpus endpoint
  `GET /translate/corpus-match?q=` that returns the best `desc_ja/desc_en` pairs by trigram
  similarity (SQLite query on `active_skills` + `leader_skills`, ≈ 13k rows, in-memory index built at
  startup). Both are free; the only external dependency is Google's unofficial endpoint, which the
  repo already relies on for names (risk: rate limits / breakage → cached, queued, and the UI
  degrades to "JP text shown, EN empty").
- No API key, no upload of images to any server: OCR and matching are local; only short text
  strings go to our server for translation.

### B. OCR on the server (node `tesseract.js` or a Python service) — not chosen

Same engine, same accuracy, but requires an image upload endpoint, body limits and server CPU; the
browser already has the canvas and the user's time. Keep as an option if phones prove too slow.

### C. Claude vision (paid) — dropped per decision 5

Would have read inline icons and translated in one call at ≈ $0.02–0.03 per screenshot; requires an
API key and budget. Documented in rev 1 of this plan (git history).

## 4. Implementation plan

### 4.1 Spike (1 day) — settle the unknowns first

- [ ] Layout: `detectJpDetailLayout()` for the 1242×2200 profile; anchor on the three gold-bordered
      panels (stats / スキル / リーダースキル) via horizontal edge profiles so letterboxing on other
      aspect ratios does not break it. Validate on the 4 samples + other devices if available.
      Fallback: fixed fractions + a manual "adjust boxes" step.
- [ ] Digit templates: build glyph set from the samples, verify 100 % on all numbers of the 4 samples
      (number, HP/ATK/RCV, +99, Lv, cost, turns).
- [ ] Thumbnail double check on a JP detail screenshot of a card that **is** in the DB (the 4 samples
      are not); fix the KNOWN thresholds (expect ≥ 0.9).
- [ ] Awakening sprite matching on the 9 + 1 icons of each sample; colour-variant icons (10c+, L-unlock,
      enhanced orbs) must separate top-1.
- [ ] Inline icon masking in skill text: template-match orb/lock/awakening glyphs inside the AS/LS
      panels of sample 4 (line 2 of the evolving skill) and sample 1 LS (`[combo]発動`); OCR the masked
      line; confirm the merged token string.
- [ ] Corpus reuse rate: run OCR on 20 JP screenshots of **known** cards (any JP detail screens; the DB
      gives the truth) and measure how many AS/LS texts hit ≥ 0.92 similarity → tells how often
      translation is a lookup vs. google. Also measures OCR character error rate on this font.
- [ ] tesseract footprint: measure actual download (core + jpn data) and first-run time on a mid-range
      Android WebView.

### 4.2 Client library (`web/src/lib/translate/`)

- `layout.ts` — JP detail-screen profile + detection + box types; tests on downscaled fixtures.
- `digits.ts` — glyph templates + `readNumber(img, box)`; tests on fixture crops.
- `identify.ts` — number + thumbnail → `{ kind: "known" | "new", id?, score, flags[] }`
  (reuses `descriptorForId`, `rankIconCandidates`, `loadIconIndex`).
- `awakenings.ts` — sprite template matching for the column + SA; returns `{ id, score }[]`.
- `attributes.ts` — thumbnail corner orbs → attribute 1/2 (colour classification).
- `jp-types.ts` — JP type label → type id dictionary (+ test).
- `inline-icons.ts` — find orb / lock / awakening glyphs inside a text panel, mask, token list.
- `ocr.ts` — tesseract worker wrapper (lazy init, self-hosted paths, per-box PSM, two
  preprocessings with confidence voting), `mergeIconTokens(words, icons)`.
- `jp-text.ts` — OCR clean-up (`のの`→`の`, `人の`→`の`, `B2%`→`82%`, `O`→`0` in digit runs) and
  glossary pre/post replacement; tests from the probe strings above.
- `corpus.ts` — client cache for `/translate/corpus-match`; number substitution into `desc_en`.
- `cdn-assets.ts` — HEAD portrait/icon, fetch as blob when 200 (CORS `*`), else crop.
- `to-custom-draft.ts` — all of the above → `CustomCardDraft` (`activeSkillCdMin = turns`,
  `cdMax = null`; 進化スキル → `activeSkillType: "evo"` with the visible stage only; `name` = EN,
  `nameJa` = JP; `level`, `maxLevel`, `plusHp/Atk/Rcv` (99 or 0), `cost`).

### 4.3 Server (`src/api/`)

- `POST /translate/labels` — `{ texts: string[] }` → `{ texts: string[] }` via
  `NameTranslationService.translateLabels()` (limits: 10 strings, 300 chars each, per-IP 60/10 min).
- `GET /translate/corpus-match?q=&kind=active|leader` — top-3 `{ ja, en, score }` by character
  trigram Jaccard over `desc_ja` with digits normalised; index built lazily in memory.
- Tests: trigram matcher on 3 known JP descriptions (exact, with OCR noise, with changed numbers);
  limits.

### 4.4 Card template changes (decisions 1 and 4)

- `CustomCardDraft`: add `nameJa: string`, `level: number | null`, `maxLevel: number | null`,
  `plusHp/plusAtk/plusRcv: number | null`, `cost: number | null`.
- `MonsterDetailCard`: optional `nameSub` (small JP name under the English name), optional
  `statsMeta` line rendered as on the JP screen: `HP 48,389 (+99) · ATK 29,987 (+99) · RCV 5,456 (+99)
  · Lv.120 / 120 · Cost 30`. Shown only when provided, so existing cards do not change. Cooldown
  shows `CD N` only when `cdMax` is null (decision 3). Editors in `/custom-card` get the new fields.

### 4.5 UI

- New tool `/translate` ("Translate", icon 🈯) in `APP_TOOLS` + route in `main.tsx`.
- `TranslatePage.tsx`: drop zone / paste / multi-file input → queue; per item: progress (layout →
  numbers → identify → OCR → translate) → result:
  - KNOWN: `MonsterDetailCard` with CDN art/icon, `copyImageButton`, the screenshot stats line, a
    note "Matched No.14280 · icon score 0.95", and "Not this card? Treat as new".
  - NEW: JP OCR text (editable) ↔ EN fields with confidence flags and "from DB" / "machine
    translated" badges, awakening row with low-score icons outlined, art/icon preview with
    "CDN" / "cropped" badge, buttons **Open in Custom Card** (in-memory draft handoff; drafts hold
    Blobs) and **Download PNG**.
- `CustomCardPage`: accept an initial draft (`?from=translate`), otherwise unchanged.

### 4.6 Done criteria

- 4 sample screenshots → 4 NEW cards: correct number, rarity, types, attributes, stats/level/+99/cost
  as on the screenshot, ≥ 9/10 awakenings top-1, CDN art + icon (portrait yes, icon falls back to
  crop since the CDN icon is 403), JP name under EN name, AS/LS EN text accepted with ≤ minor edits,
  PNG export works.
- One JP screenshot of a DB card → KNOWN, rendered from DB, no OCR run.
- Google endpoint down → JP text still shown, EN fields empty, UI explains; nothing crashes.
- `npm test`, `npm run build:web`, `npm run build` pass; new tests added to the root test list.

## 5. Phasing

| Phase | Scope | Notes |
|---|---|---|
| 1 | Layout, digit templates, identify, KNOWN render, NEW draft with numbers/rarity/types/attrs/awakenings/CDN-or-crop art, template fields (decisions 1, 3, 4), Custom Card handoff | no OCR of kana/kanji yet: name and skill text are typed by the user |
| 2 | tesseract.js OCR + inline icon masking + corpus match + google-translate review UI | this is what "phase 2" means: the free text-reading layer on top of phase 1; it needs the spike results (OCR error rate, corpus hit rate) before committing to the UX |
| 3 | Batch export (zip), evolving-skill stages, more device layouts, OCR clean-up rules learned from use | — |

## 6. Risks and unknowns

| Risk | Impact | Mitigation |
|---|---|---|
| Other devices / aspect ratios move the panels | detection fails | panel-anchored detection; manual box adjust; collect more samples |
| Thumbnail vs CDN icon threshold unverified (samples not in DB) | wrong KNOWN/NEW split | spike on a DB card; always show the override |
| tesseract misreads kana/kanji (`クロミとバク` failed) | wrong JP → wrong EN | corpus fuzzy match, clean-up rules, editable JP field; names of known characters can be matched against `name_ja` substrings |
| Inline icons break OCR lines | garbage text | mask + token merge (spike 4.1); fallback: user edits |
| google-translate-api-x is unofficial | may break / rate-limit | queue + cache already exist; corpus reuse avoids it for repeated skills; UI degrades to JP-only |
| tesseract download on mobile data | several MB on first use | self-host, lazy, cache; phase 1 works without it |
| Similar awakening icons (colour variants) | wrong awakening | RGB descriptor; outline low scores |
| Seed DB older than CDN | KNOWN path misses new cards | expected; NEW path handles it; admin "refresh-db" later turns them into KNOWN |

## 7. Decisions (closed 2026-11-06)

1. Stats: show HP/ATK/RCV, +99, Lv / max Lv and cost as on the screenshot, on the card.
2. Art/icon: CDN first, crop from the screenshot only when the CDN has no file.
3. Cooldown: show only the max-level turns.
4. Name: English large, Japanese smaller underneath.
5. No budget: free libraries only (tesseract.js, existing google-translate path, DB corpus).
