/**
 * Geometry of the JP client's monster detail screen.
 *
 * Every position is expressed in "reference pixels" measured on a 1242×2200 screenshot and
 * scaled by the actual width. The screen has two vertical anchors that move together on the
 * reference device but are detected separately so a different aspect ratio can shift the
 * bottom panel block without breaking the top block:
 *
 * - `headerTop`: first row of the "No.XXXXX" text (top block: number, name, stars, type row,
 *   art, super awakening, awakening column).
 * - `statsTop`: the gold top border of the stats panel (bottom block: thumbnail, HP/ATK/RCV,
 *   level, cost, skill and leader-skill panels).
 */
import type { Box, RgbaImage } from "../team-build/screenshot/descriptor.ts";
import { isGold, isTextLike, pixelAt } from "./pixels.ts";

export const REFERENCE_WIDTH = 1242;
export const REFERENCE_HEIGHT = 2200;
/** Row of the "No." text on the reference screenshot. */
export const REFERENCE_HEADER_TOP = 24;
/** Row of the stats panel's gold top border on the reference screenshot. */
export const REFERENCE_STATS_TOP = 1477;
/** Awakening icons in the right-hand column (reference pixels). */
export const AWAKENING_SLOTS = 9;
export const AWAKENING_PITCH = 97.1;

export type DetailLayout = {
  width: number;
  height: number;
  /** Reference pixel → image pixel factor. */
  scale: number;
  headerTop: number;
  statsTop: number;
  /** True when an anchor could not be detected and the reference position was used. */
  headerFallback: boolean;
  statsFallback: boolean;
  number: Box;
  name: Box;
  stars: Box;
  typeRow: Box;
  art: Box;
  superAwakening: Box;
  awakenings: Box[];
  thumb: Box;
  hp: Box;
  atk: Box;
  rcv: Box;
  plusHp: Box;
  plusAtk: Box;
  plusRcv: Box;
  level: Box;
  maxLevel: Box;
  cost: Box;
  turns: Box;
  activeLabel: Box;
  activeName: Box;
  activeDesc: Box;
  leaderName: Box;
  leaderDesc: Box;
};

function box(scale: number, x: number, y: number, w: number, h: number): Box {
  return { x: x * scale, y: y * scale, w: w * scale, h: h * scale };
}

/**
 * Row of the stats panel's top gold border: the first strong gold line in the lower part of
 * the screen. Returns null when no row is gold across most of the width.
 */
export function findStatsTop(img: RgbaImage): number | null {
  const { width, height } = img;
  const need = width * 0.7;
  for (let y = Math.floor(height * 0.5); y < height * 0.85; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) if (isGold(pixelAt(img, x, y))) n++;
    if (n >= need) return y;
  }
  return null;
}

/** First row of the card number text in the header (gold / white text left of the stars). */
export function findHeaderTop(img: RgbaImage): number | null {
  const { width, height } = img;
  const x0 = Math.floor(width * 0.16);
  const x1 = Math.floor(width * 0.42);
  const need = Math.max(6, width * 0.008);
  for (let y = 0; y < height * 0.08; y++) {
    let n = 0;
    for (let x = x0; x < x1; x++) if (isTextLike(pixelAt(img, x, y))) n++;
    if (n >= need) return y;
  }
  return null;
}

/** Layout for an image of the given size with explicit anchors (reference pixels already scaled). */
export function layoutFromAnchors(
  width: number,
  height: number,
  headerTop: number,
  statsTop: number,
  flags: { headerFallback: boolean; statsFallback: boolean } = {
    headerFallback: false,
    statsFallback: false,
  }
): DetailLayout {
  const s = width / REFERENCE_WIDTH;
  const ht = headerTop / s;
  const st = statsTop / s;
  const awakenings: Box[] = [];
  for (let k = 0; k < AWAKENING_SLOTS; k++) {
    awakenings.push(box(s, 1150, ht + 329 + k * AWAKENING_PITCH, 58, 58));
  }
  return {
    width,
    height,
    scale: s,
    headerTop,
    statsTop,
    headerFallback: flags.headerFallback,
    statsFallback: flags.statsFallback,
    number: box(s, 196, ht - 4, 340, 54),
    name: box(s, 196, ht + 42, 700, 54),
    // Up to 10 stars at a 46.5 px pitch from x ≈ 497; stops before the wing decoration.
    stars: box(s, 492, ht - 6, 482, 44),
    typeRow: box(s, 12, ht + 132, 620, 56),
    art: box(s, 60, ht + 300, 1122, 950),
    superAwakening: box(s, 1057, ht + 329, 58, 58),
    awakenings,
    thumb: box(s, 20, st + 24, 196, 196),
    hp: box(s, 330, st + 30, 175, 50),
    atk: box(s, 330, st + 91, 175, 50),
    rcv: box(s, 330, st + 151, 175, 50),
    plusHp: box(s, 505, st + 30, 145, 50),
    plusAtk: box(s, 505, st + 91, 145, 50),
    plusRcv: box(s, 505, st + 151, 145, 50),
    // Digits only: the "Lv." / "最大Lv." labels to the left are teal as well.
    level: box(s, 737, st + 28, 185, 50),
    maxLevel: box(s, 822, st + 78, 185, 50),
    cost: box(s, 1095, st + 38, 120, 50),
    turns: box(s, 1030, st + 248, 185, 50),
    activeLabel: box(s, 30, st + 240, 160, 60),
    activeName: box(s, 190, st + 244, 820, 52),
    activeDesc: box(s, 28, st + 303, 1190, 126),
    leaderName: box(s, 378, st + 462, 840, 54),
    leaderDesc: box(s, 28, st + 528, 1190, 126),
  };
}

/** Detect both anchors on `img` and build the layout; missing anchors fall back to the reference. */
export function detectDetailLayout(img: RgbaImage): DetailLayout {
  const s = img.width / REFERENCE_WIDTH;
  const header = findHeaderTop(img);
  const stats = findStatsTop(img);
  return layoutFromAnchors(
    img.width,
    img.height,
    header ?? REFERENCE_HEADER_TOP * s,
    stats ?? REFERENCE_STATS_TOP * s,
    { headerFallback: header == null, statsFallback: stats == null }
  );
}
