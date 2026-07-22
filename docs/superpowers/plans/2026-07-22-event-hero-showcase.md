# Event Hero Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the `/event/:id` hero so cover monsters render in a large adaptive art grid with the event title below — no subtitle or fan layout.

**Architecture:** Pure presentational change in `EventHero`. Derive CSS grid column count from `coverMonsters.length`; each cell is a non-interactive `MonsterPortrait`. Drop `subtitle` from the hero API surface.

**Tech Stack:** React, Tailwind utility classes, existing `MonsterPortrait`

**Spec:** `docs/superpowers/specs/2026-07-22-event-hero-showcase-design.md`

## Global Constraints

- Frontend only — no API/seed changes
- Hero shows title + art only (no subtitle, date, dividers)
- Hero cells are not clickable
- Grid: 1→1col, 2→2col, 3–4→2col, 5–6→3col, 7–9→3col; art region ~55–70vh
- Do not commit unless the user explicitly asks

---

### Task 1: Adaptive grid helper + EventHero rewrite

**Files:**
- Modify: `web/src/event/EventHero.tsx`
- Modify: `web/src/event/EventDetailPage.tsx` (stop passing `subtitle`)

**Interfaces:**
- Consumes: `MonsterPortrait`, `MonsterRecord`
- Produces: `EventHero({ title: string; coverMonsters: MonsterRecord[] })`

- [x] **Step 1: Replace `EventHero.tsx` with adaptive grid + title-below layout**

```tsx
import { MonsterPortrait } from "../components/MonsterPortrait";
import type { MonsterRecord } from "../types";

type Props = {
  title: string;
  coverMonsters: MonsterRecord[];
};

/** Columns for adaptive cover grid (spec: 1 / 2 / 2×2 / 3×2 / 3×3). */
export function coverGridColumns(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  return 3;
}

export function EventHero({ title, coverMonsters }: Props) {
  const count = coverMonsters.length;
  const cols = coverGridColumns(count);

  return (
    <section className="relative overflow-hidden border-b-2 border-[#a8842f] bg-[radial-gradient(ellipse_at_50%_-10%,#3a2c1a_0%,#0d0a06_65%)] px-3 pb-8 pt-4 sm:px-4 sm:pb-10 sm:pt-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 15%, rgba(255,213,79,0.12), transparent 40%), radial-gradient(circle at 82% 8%, rgba(255,213,79,0.1), transparent 45%)",
        }}
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center">
        {count > 0 && (
          <div
            className="grid w-full gap-1.5 sm:gap-2"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              maxHeight: "70vh",
            }}
          >
            {coverMonsters.map((row, i) => (
              <div
                key={row.monster_id ?? i}
                className="flex min-h-0 items-end justify-center overflow-hidden rounded-sm bg-[#120e0a]/90"
                style={{
                  // Keep total art block large: divide viewport budget by row count.
                  height: `min(${Math.floor(68 / Math.ceil(count / cols))}vh, 420px)`,
                }}
              >
                <MonsterPortrait
                  monsterId={row.monster_id ?? 0}
                  alt={row.name_en ?? ""}
                  variant="portrait"
                  className="h-full w-full object-contain object-bottom drop-shadow-[0_8px_20px_rgba(0,0,0,0.55)]"
                />
              </div>
            ))}
          </div>
        )}
        <h1
          className="mt-5 bg-[linear-gradient(180deg,#fff6d8_0%,#ffd54f_45%,#b8860b_100%)] bg-clip-text text-center text-2xl font-black uppercase leading-tight text-transparent drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] sm:mt-6 sm:text-4xl md:text-5xl"
          style={{ letterSpacing: "0.04em" }}
        >
          {title}
        </h1>
      </div>
    </section>
  );
}
```

- [x] **Step 2: Update `EventDetailPage` to match new props**

Remove `subtitle={event.data.subtitle}` from `<EventHero … />`.

- [x] **Step 3: Typecheck / lint the touched files**

Touched event files clean under IDE diagnostics. Full `web` `tsc` still reports pre-existing errors unrelated to this change.

- [ ] **Step 4: Manual verify**

Open `/event/cd-collab-fairies-return` — expect 3×2 large portraits, title below, no subtitle. Confirm sections/modal still work.

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Adaptive grid rules | Task 1 `coverGridColumns` |
| Title below, no subtitle | Task 1 |
| Non-interactive cells | Task 1 (no handlers) |
| ~55–70vh art | Task 1 cell height |
| Empty covers → title only | Task 1 `count > 0` guard |
| List/API unchanged | N/A (not touched) |
