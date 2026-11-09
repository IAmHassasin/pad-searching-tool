/**
 * Part Break Bonus (awakening 131): each broken part multiplies the holder's HP / ATK /
 * RCV. Copies add to the per-part rate (1 copy ×1.2, 2 copies ×1.4, 3 copies ×1.6 per
 * part — 「効果は所持数分加算される」, confirmed in-game by the user on 2026-11-09) and
 * parts multiply: 2 copies with 2 parts broken = 1.4² = ×1.96.
 * Source: [AppMedia 78103214](https://appmedia.jp/pazudora/78103214) (Ver.22.0).
 */
export const PART_BREAK_AWAKENING_ID = 131;
export const PART_BREAK_RATE_PER_COPY = 0.2;
/** Upper bound for the parts counter (no dungeon in the floor tables has more). */
export const MAX_PARTS_BROKEN = 10;

export function clampPartsBroken(parts: number): number {
  if (!Number.isFinite(parts)) return 0;
  return Math.max(0, Math.min(MAX_PARTS_BROKEN, Math.trunc(parts)));
}

/** Stat multiplier for a card with `copies` Part Break Bonus awakenings. */
export function partBreakMultiplier(copies: number, partsBroken: number): number {
  const c = Number.isFinite(copies) ? Math.max(0, Math.trunc(copies)) : 0;
  const n = clampPartsBroken(partsBroken);
  if (c === 0 || n === 0) return 1;
  return Math.pow(1 + PART_BREAK_RATE_PER_COPY * c, n);
}

/** Number of Part Break Bonus entries in a list of awakening ids. */
export function countPartBreakCopies(awakeningIds: readonly number[]): number {
  return awakeningIds.filter((id) => id === PART_BREAK_AWAKENING_ID).length;
}
