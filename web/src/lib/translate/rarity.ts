/** Rarity = number of gold stars in the header row. */
import type { Box, RgbaImage } from "../team-build/screenshot/descriptor.ts";
import { columnCounts, isGold, isYellow, maskBox, runsAbove, type Rgb } from "./pixels.ts";

const isStar = (p: Rgb) => isYellow(p) || isGold(p);

/** Width of one star on the reference screenshot (1242 px wide). */
const STAR_WIDTH_REF = 34;

export function countStars(img: RgbaImage, box: Box, scale: number): number {
  const mask = maskBox(img, box, isStar);
  if (mask.width === 0 || mask.height === 0) return 0;
  const cols = columnCounts(mask);
  // Only the upper part of a star is saturated yellow; the gaps between stars are empty, so
  // any inked column run at least half a star wide counts as one star.
  const minWidth = Math.max(4, Math.round(STAR_WIDTH_REF * scale * 0.5));
  return runsAbove(cols, 1, minWidth).length;
}
