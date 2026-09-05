# Custom Card Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/custom-card` — live PAD detail-card editor with PNG art/icon crop, editable fields, and high-res PNG download (v1 only; no evo tree).

**Architecture:** Session `CustomCardDraft` state maps to `MonsterRecord` + optional art/icon blob URLs. Preview reuses `MonsterDetailCard` with small prop extensions. Export via `modern-screenshot` on a clean export root.

**Tech Stack:** React 19, Vite, Tailwind 4, `modern-screenshot`, existing awakening/attr/type UI pieces.

## Global Constraints

- Scope v1: single card only (no evo tree UI)
- Skills: free text only
- Persistence: session-only (no localStorage)
- PNG art only; soft max ~8MB
- Super vs Sync mutually exclusive
- Download allowed anytime; hide Evo/Group/Google/Resonate on export preview
- Spec: `docs/superpowers/specs/2026-09-04-custom-card-design.md`

## File map

| File | Responsibility |
|------|----------------|
| `web/src/custom-card/types.ts` | Draft type + defaults |
| `web/src/custom-card/draft-to-row.ts` | Draft → MonsterRecord |
| `web/src/custom-card/export-png.ts` | Capture + download helper |
| `web/src/custom-card/CustomCardPage.tsx` | Shell + state |
| `web/src/custom-card/*Editor*.tsx` | Editor panels |
| `web/src/custom-card/ArtUploadPanel.tsx` | PNG upload |
| `web/src/custom-card/IconCropModal.tsx` | Square crop |
| `web/src/custom-card/CustomCardPreview.tsx` | Preview export root |
| `MonsterPortrait.tsx` | Optional `src` |
| `MonsterDetailCard.tsx` | `artSrc`/`iconSrc`/`showAttributes`/`hideUtilityLinks` |
| `main.tsx`, `app-tools.ts` | Route + nav |
| `web/package.json` | `modern-screenshot` |

---

### Task 1: Shared portrait/card props + dependency

**Files:** Modify `MonsterPortrait.tsx`, `MonsterDetailCard.tsx`; add dep `modern-screenshot`

- [ ] Add optional `src?: string` to `MonsterPortrait` (prefer over CDN)
- [ ] Add `artSrc`, `iconSrc`, `showAttributes`, `hideUtilityLinks` to `MonsterDetailCard`
- [ ] `npm install modern-screenshot` in `web/`

### Task 2: Draft model + mapper + export helper

**Files:** Create `types.ts`, `draft-to-row.ts`, `export-png.ts`

- [ ] `CustomCardDraft` + `createEmptyDraft()`
- [ ] `draftToPreviewRow(draft)`
- [ ] `exportElementToPng(el, filename)` with scale `Math.min(3, Math.max(2, devicePixelRatio))`

### Task 3: Editors + crop + page + route

**Files:** Create custom-card components; wire `main.tsx` + `app-tools.ts`

- [ ] Art upload, icon crop modal, identity/attr/type/awk/skill/stats editors
- [ ] `CustomCardPage` 2-column layout + Download PNG
- [ ] Route `/custom-card` + nav entry
- [ ] `npm run build` in `web/` passes

### Task 4: Manual acceptance

- [ ] Verify acceptance checklist from spec §9
