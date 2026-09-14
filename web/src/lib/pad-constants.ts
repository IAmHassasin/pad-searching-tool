/**
 * PAD monster card — background & artwork anchors.
 * Percentages are relative to the art frame (not the full card), so skill
 * height cannot shift the portrait. 50% = visual center of that frame.
 */
export const PAD_CARD_VISUAL = {
  bgAnchorY: 28,
  artAnchorY: 50,
  /** Portrait / custom art — full-bleed width (scale via crop zoom, not a height box). */
  artWidthPct: 110,
} as const;

/** Awakening icon strip on monster detail card. */
export const PAD_AWAKENING = {
  iconSizePx: 20,
  columnWidthPx: 28,
  iconGapPx: 10,
  artAreaMinHeightPx: 200,
} as const;

/** Auto-shrink skill / leader text so long evo skills don't bury art. */
export const PAD_SKILL_FIT = {
  maxPx: 10,
  minPx: 7,
  compactMaxPx: 9,
  compactMinPx: 6.5,
  maxHeightPx: 230,
  compactMaxHeightPx: 170,
} as const;
