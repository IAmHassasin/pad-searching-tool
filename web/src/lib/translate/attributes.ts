/**
 * Attributes from the orbs drawn over the thumbnail icon: main attribute top-left, sub
 * attribute bottom-left, third attribute bottom-right. Each orb is classified by the hue of
 * its vivid pixels.
 */
import type { Box, RgbaImage } from "../team-build/screenshot/descriptor.ts";
import { clampBox, hueSat, pixelAt } from "./pixels.ts";

/** dadguide attribute ids. */
export const ATTR_FIRE = 0;
export const ATTR_WATER = 1;
export const ATTR_WOOD = 2;
export const ATTR_LIGHT = 3;
export const ATTR_DARK = 4;
export const ATTR_HEART = 5;

/** Orb squares inside a 196-px reference thumbnail (fractions of the thumbnail size). */
const ORB_SIZE = 0.23;
const ORB_INSET = 0.02;

/** Orb token (as used in skill text) per attribute id. */
export const ORB_TOKEN_BY_ATTRIBUTE: Record<number, string> = {
  [ATTR_FIRE]: "[Fire]",
  [ATTR_WATER]: "[Water]",
  [ATTR_WOOD]: "[Wood]",
  [ATTR_LIGHT]: "[Light]",
  [ATTR_DARK]: "[Dark]",
  [ATTR_HEART]: "[Heal]",
};

export function attributeOfHue(hue: number): number {
  if (hue < 25 || hue >= 340) return ATTR_FIRE;
  if (hue < 75) return ATTR_LIGHT;
  if (hue < 170) return ATTR_WOOD;
  if (hue < 255) return ATTR_WATER;
  if (hue < 305) return ATTR_DARK;
  return ATTR_HEART;
}

/** Dominant attribute colour of `box`, or null when too few vivid pixels are present. */
export function classifyOrb(img: RgbaImage, box: Box, minShare = 0.12): { id: number; share: number } | null {
  const { x0, y0, x1, y1 } = clampBox(img, box);
  const votes = new Array<number>(6).fill(0);
  let vivid = 0;
  const total = (x1 - x0) * (y1 - y0);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = pixelAt(img, x, y);
      const { hue, sat } = hueSat(p);
      if (sat < 0.45 || Math.max(p[0], p[1], p[2]) < 110) continue;
      vivid++;
      votes[attributeOfHue(hue)]++;
    }
  }
  const share = total ? vivid / total : 0;
  if (share < minShare) return null;
  let best = 0;
  for (let i = 1; i < votes.length; i++) if (votes[i] > votes[best]) best = i;
  return { id: best, share };
}

export type ThumbAttributes = {
  attribute1: number | null;
  attribute2: number | null;
  attribute3: number | null;
};

export function orbBoxes(thumb: Box): { main: Box; sub: Box; third: Box } {
  const size = thumb.w * ORB_SIZE;
  const inset = thumb.w * ORB_INSET;
  return {
    main: { x: thumb.x + inset, y: thumb.y + inset, w: size, h: size },
    sub: { x: thumb.x + inset, y: thumb.y + thumb.h - inset - size, w: size, h: size },
    third: { x: thumb.x + thumb.w - inset - size, y: thumb.y + thumb.h - inset - size, w: size, h: size },
  };
}

export function readThumbAttributes(img: RgbaImage, thumb: Box): ThumbAttributes {
  const boxes = orbBoxes(thumb);
  return {
    attribute1: classifyOrb(img, boxes.main)?.id ?? null,
    attribute2: classifyOrb(img, boxes.sub)?.id ?? null,
    attribute3: classifyOrb(img, boxes.third)?.id ?? null,
  };
}
