# Custom Card page (v1) + Evolution Tree (planned)

**Date:** 2026-09-04  
**Status:** Approved for planning (user: scope A, Approach 1)  
**Route:** `/custom-card`

## Summary

Add a nav tool page where users build a PAD-style monster **details card** from scratch: upload PNG art, crop an icon region, pick attributes/types/rarity/number/name, stack awakenings (regular / super / sync), free-text active & leader skills, edit HP/ATK/RCV, live-preview via the existing details-card UI, and **download a high-resolution PNG**. Session-only state (refresh clears). A full **custom evolution tree** studio is designed below but **out of v1 implementation**.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope v1 | Single card only; evo tree planned, not built |
| Architecture | Wrap / drive `MonsterDetailCard` + DOM→PNG export |
| Skills | Free text only (no copy-from-monster) |
| Types + stats | Fully editable |
| Persistence | Session-only (no localStorage / share URL) |
| Name | Editable |
| Export | PNG at highest practical quality (devicePixelRatio × scale) |

## Non-goals (v1)

- Server upload / CDN hosting of custom art
- localStorage, shareable URLs, or JSON import/export
- Copy AS/LS from existing monsters
- Vanish / void-super-gravity lines on custom skills
- Building or exporting a custom evolution tree
- Android-specific Capacitor file APIs beyond normal browser download

---

## §1 Route & page layout

**Registration**

- `web/src/main.tsx` — `path === "/custom-card"` → `CustomCardPage`
- `web/src/lib/app-tools.ts` — `APP_TOOLS` entry: `href: "/custom-card"`, `label: "Custom"`, `description: "Build a custom monster card"`, icon e.g. `🎨`

**Page shell**

- Header: `AppToolsNav variant="inline"` + title + primary **Download PNG** button
- Desktop: 2-column — left **live preview**, right **editor panels**
- Mobile: preview on top; editor as stacked / accordion sections; Download sticky or in header

**State**

- Single React state object `CustomCardDraft` (see Data model)
- No persistence beyond the tab session
- Blob URLs for art/icon must be `revokeObjectURL` on replace/unmount

---

## §2 Art, icon crop, attributes, identity

### Art

- Accept **PNG only** (file picker + drag-drop)
- Soft size limit (~8 MB); clear error if type/size invalid
- Store `File` / `Blob` + `artObjectUrl` for full-art preview

### Icon crop

- After art is loaded, user opens a **square cropper** over the uploaded image (drag + zoom)
- Confirm → canvas export of the cropped square as PNG → `iconObjectUrl`
- **Recrop** reopens the same editor; until cropped, icon slot shows empty placeholder
- Crop math stored as normalized rect `{ x, y, size }` relative to natural image (0–1) so re-export stays consistent if we later re-encode

### Attributes

- Three slots: `attribute1` / `attribute2` / `attribute3` (Fire…Dark or None), same id scheme as `monster-attributes.ts`
- Preview shows attribute strip (detail card today omits attrs — custom preview must show them; see Touchpoints)

### Types, rarity, number, name

- Types: up to 3 from existing type list (`monster-types.ts` / `MonsterTypeStrip` data)
- Rarity: integer stars (0–10), rendered with `StarRow`
- Number: editable integer shown as `No.#` (and optional NA# same or separate — **v1: one number field mapped to both `monster_id` display and `monster_no_na`**, or only `monster_id` / No. as on card header — use the same number for the card’s No. line)
- Name: free text → `name_en`

---

## §3 Awakenings, skills, stats

### Awakenings

Reuse filter group picker UI patterns (`AWAKENING_FILTER_GROUPS`, sprite icons):

| Layer | Behavior |
|-------|----------|
| Regular | Ordered stack; tap to add; chips to remove one |
| Super | Ordered stack of ids |
| Sync | At most **one** id |

**Super vs Sync:** mode toggle `Super | Sync`. Entering Sync clears Super list; entering Super clears Sync. Preview uses existing `resolvePrefixedAwakeningIds` / `SuperAwakeningStrip` / `AwakeningIconList` after mapping draft → record-like fields (`awakenings` string, `super_awakenings`, `sync_awsid`).

### Skills (free text)

- Active: name, description, optional CD min / CD max
- Leader: name, description
- No GameWith vanish / void lines; no stage-CD parsing unless user types numbers into CD fields only

### Stats

- Editable `hpMax`, `atkMax`, `rcvMax` → `StatRow` on card

Preview updates on every draft change.

---

## §4 PNG export

**Library:** add `modern-screenshot` (preferred over html-to-image for font/CSS fidelity) as a web dependency.

**Target node:** a dedicated **export root** wrapping the preview card:

- Hide chrome: Evo / Group / Google / Assist Resonance / change-target strips (pass flags / omit callbacks so those controls do not render)
- Wait for art + icon `<img>` `onLoad` (and awakening sprites) before capture
- Capture options: `scale: 2` minimum, prefer `Math.max(2, devicePixelRatio)` up to 3; `backgroundColor` matching card chrome so no transparency seams
- Filename: `custom-card-{number-or-name}.png`
- Trigger via temporary `<a download>` or `URL.createObjectURL` + click; revoke after

**Quality notes**

- Prefer exporting from a mounted off-screen / fixed-width clone at the same CSS size as the live card so layout matches game card proportions (`PAD_CARD_VISUAL`)
- Cross-origin: user blobs are same-origin; awakening sprite sheet and `background.png` are bundled assets — OK for canvas taint
- If capture fails, show inline error; do not silently download empty PNG

---

## §5 Data model & mapping

```ts
type CustomCardDraft = {
  name: string;
  number: number | null;
  rarity: number;
  attribute1: number | null;
  attribute2: number | null;
  attribute3: number | null;
  type1: number | null;
  type2: number | null;
  type3: number | null;
  awakeningIds: number[];
  superAwakeningIds: number[];
  syncAwakeningId: number | null;
  prefixedMode: "super" | "sync";
  activeSkillName: string;
  activeSkillDesc: string;
  activeSkillCdMin: number | null;
  activeSkillCdMax: number | null;
  leaderSkillName: string;
  leaderSkillDesc: string;
  hpMax: number | null;
  atkMax: number | null;
  rcvMax: number | null;
  artBlob: Blob | null;
  artObjectUrl: string | null;
  iconBlob: Blob | null;
  iconObjectUrl: string | null;
  iconCrop: { x: number; y: number; size: number } | null; // normalized
};
```

**Mapper** `draftToPreviewRow(draft): MonsterRecord` (+ separate art/icon URL props for portrait override).

Awakening serialization: join regular ids as comma list compatible with `parseRegularAwakenings`; super as comma list; sync as `sync_awsid`.

---

## §6 Component / file structure (v1)

| Path | Role |
|------|------|
| `web/src/custom-card/CustomCardPage.tsx` | Shell, state, download handler |
| `web/src/custom-card/types.ts` | `CustomCardDraft`, defaults |
| `web/src/custom-card/draft-to-row.ts` | Map draft → `MonsterRecord` |
| `web/src/custom-card/CustomCardPreview.tsx` | Preview + export root |
| `web/src/custom-card/ArtUploadPanel.tsx` | PNG upload / dropzone |
| `web/src/custom-card/IconCropModal.tsx` | Square crop UI |
| `web/src/custom-card/IdentityEditor.tsx` | Name, number, stars |
| `web/src/custom-card/AttributeTypeEditor.tsx` | Attr + type pickers |
| `web/src/custom-card/AwakeningEditor.tsx` | Regular / Super / Sync |
| `web/src/custom-card/SkillEditor.tsx` | AS / LS free text |
| `web/src/custom-card/StatsEditor.tsx` | HP / ATK / RCV |
| `web/src/custom-card/export-png.ts` | `modern-screenshot` helper |
| `web/src/main.tsx` | Route |
| `web/src/lib/app-tools.ts` | Nav entry |

**Shared extensions (minimal, reuse-first)**

1. `MonsterPortrait` — optional `src?: string`; when set, use instead of CDN `portraitUrl` / `iconUrl`
2. `MonsterDetailCard` — optional `artSrc` / `iconSrc`; optional `showAttributes?: boolean` (render `MonsterAttributeStrip`); when `onOpenEvo` / `onOpenCollab` omitted and no change targets, hide relation chrome (already mostly true) — ensure Google / Assist Resonance can be suppressed via `hideUtilityLinks?: boolean` for export cleanliness

Avoid forking the entire card markup if these props suffice.

---

## §7 Evolution tree — UI plan (phase 2, not v1)

Goal: same custom-card nodes arranged as a **custom evolution tree**, exportable as one PNG or per-node.

### Layout concept

```
[ Tool nav | Custom Evo Tree     Add node | Download tree PNG ]

┌────────────── canvas (pan/zoom) ──────────────┬─ Node inspector ─┐
│   (base)                                      │ Selected node =  │
│     ↓                                         │ full Custom Card │
│   (mid A) → (mid B)                           │ editor (reuse)   │
│     ↓                                         │                  │
│   (final)                                     │ Edge: parent →   │
│                                               │ child            │
└───────────────────────────────────────────────┴──────────────────┘
```

### Interaction

- **Nodes:** each node holds a full `CustomCardDraft` (or shared art library + per-node overrides)
- **Add node** / **duplicate** / **delete**
- **Edges:** click parent then child (or drag handle) to link evolution; one parent → many children allowed (branching)
- **Canvas:** pan/zoom; mini **icon** portraits on nodes (cropped icons), click to select and edit in side panel
- **Preview modes:** tree-of-icons (default) vs expand selected node to full card overlay

### Export (phase 2)

- **Tree PNG:** render canvas (icons + connector lines + optional names) via same screenshot lib at high scale
- **Card PNG:** reuse v1 export for selected node
- Optional later: zip of all node PNGs

### Data (phase 2)

```ts
type CustomEvoTree = {
  nodes: { id: string; draft: CustomCardDraft; x: number; y: number }[];
  edges: { from: string; to: string }[];
};
```

Persistence / JSON share can land with phase 2 even if v1 stays session-only.

### Implementation note

Phase 2 route options: `/custom-card/tree` sub-page, or a mode toggle on the same tool. Prefer **sub-route** so v1 card page stays focused. Reuse 100% of draft editors + export helper.

---

## §8 Error handling & empty states

- No art: full-art area empty / placeholder; Download still allowed (card chrome only) or disabled until name/number — **v1: allow download anytime**
- Invalid PNG / oversized: toast or inline error, do not replace current art
- Crop cancel: keep previous icon
- Capture failure: message “Export failed — try again after images load”

## §9 Testing / acceptance (v1)

1. Nav **Custom** opens `/custom-card`
2. Upload PNG → art appears on card
3. Crop icon → icon slot updates; Recrop works
4. Set name, number, stars, attrs, types, stats → preview matches
5. Stack regular awks; toggle Super vs Sync correctly exclusive
6. Edit AS/LS text → skill blocks update
7. **Download PNG** produces a sharp image matching preview (no Evo/Group/Google chrome)
8. Refresh clears draft

## Touchpoints summary

- New: `web/src/custom-card/**`
- Modify: `main.tsx`, `app-tools.ts`, `MonsterPortrait.tsx`, `MonsterDetailCard.tsx`
- Dependency: `modern-screenshot` in `web/package.json`
