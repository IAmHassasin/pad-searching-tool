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

const AWAKENING_ICON_SIZE_PX = 20;
const AWAKENING_ICON_GAP_PX = 10;
/** Sprite tiles are 31x32 (awakenings manifest), so a 20px-wide icon is ~20.65px tall. */
const AWAKENING_ICON_HEIGHT_PX = (AWAKENING_ICON_SIZE_PX * 32) / 31;
/** Every card reserves room for this many regular awakenings so card height is uniform. */
const STANDARD_AWAKENING_COUNT = 9;
/** Column frame (border 1px + p-0.5 2px, both sides) + wrapper py-1.5 (6px, both sides). */
const AWAKENING_COLUMN_CHROME_PX = (1 + 2) * 2 + 6 * 2;

/** Awakening icon strip on monster detail card. */
export const PAD_AWAKENING = {
  iconSizePx: AWAKENING_ICON_SIZE_PX,
  columnWidthPx: 28,
  iconGapPx: AWAKENING_ICON_GAP_PX,
  /** Art area height sized for a full 9-awakening column (~284px). */
  artAreaMinHeightPx: Math.ceil(
    STANDARD_AWAKENING_COUNT * AWAKENING_ICON_HEIGHT_PX +
    (STANDARD_AWAKENING_COUNT - 1) * AWAKENING_ICON_GAP_PX +
    AWAKENING_COLUMN_CHROME_PX
  ),
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
