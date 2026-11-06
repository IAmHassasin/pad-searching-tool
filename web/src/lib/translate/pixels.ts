/**
 * Small pixel helpers shared by the translate pipeline (browser and node): colour classes used
 * by the JP detail screen, binary masks and run detection. Everything is plain arithmetic on
 * RGBA buffers so the same code runs in node tests and in the browser.
 */
import type { Box, RgbaImage } from "../team-build/screenshot/descriptor.ts";

export type Rgb = [number, number, number];

export function pixelAt(img: RgbaImage, x: number, y: number): Rgb {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

/** Gold UI borders and the gold card number (r > g > b, warm). */
export function isGold([r, g, b]: Rgb): boolean {
  return r > 160 && g > 110 && b < 110 && r > g && g > b;
}

/** The olive-green background of the evolving-skill stage popup. */
export function isOlive(p: Rgb): boolean {
  const { hue, sat } = hueSat(p);
  const l = luminanceOf(p);
  return hue >= 55 && hue <= 100 && sat >= 0.35 && l >= 50 && l <= 160;
}

/** Light pixels that are not background (icon highlights, white text). */
export function isBrightish([r, g, b]: Rgb): boolean {
  return Math.min(r, g, b) > 140;
}

/** The lemon-yellow "(+99)" bonus text (green channel at least as strong as red). */
export function isYellow([r, g, b]: Rgb): boolean {
  return r > 170 && g > 180 && b < 110;
}

/** White text (stats, descriptions, labels). */
export function isWhite([r, g, b]: Rgb): boolean {
  return Math.min(r, g, b) > 170;
}

/** The teal "Lv.120 / 最大Lv.120" text. */
export function isTeal([r, g, b]: Rgb): boolean {
  return g > 140 && b > 100 && r < 150 && g > r + 40;
}

/** Any vividly coloured pixel (orbs, awakening icons, highlighted text). */
export function isVivid([r, g, b]: Rgb, minChroma = 70, minMax = 120): boolean {
  const mx = Math.max(r, g, b);
  return mx > minMax && mx - Math.min(r, g, b) > minChroma;
}

/** Text that is either white or vividly coloured (skill names are blue / green, numbers gold). */
export function isTextLike(p: Rgb): boolean {
  return isWhite(p) || isVivid(p, 90, 200);
}

export function luminanceOf([r, g, b]: Rgb): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Hue in degrees (0–360) and saturation (0–1) of a pixel. */
export function hueSat([r, g, b]: Rgb): { hue: number; sat: number } {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  if (d === 0 || mx === 0) return { hue: 0, sat: 0 };
  let h: number;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { hue: h, sat: d / mx };
}

export type Mask = { width: number; height: number; bits: Uint8Array };

/** Clamp `box` to the image and return integer bounds. */
export function clampBox(img: RgbaImage, box: Box): { x0: number; y0: number; x1: number; y1: number } {
  const x0 = Math.max(0, Math.min(img.width - 1, Math.round(box.x)));
  const y0 = Math.max(0, Math.min(img.height - 1, Math.round(box.y)));
  const x1 = Math.max(x0 + 1, Math.min(img.width, Math.round(box.x + box.w)));
  const y1 = Math.max(y0 + 1, Math.min(img.height, Math.round(box.y + box.h)));
  return { x0, y0, x1, y1 };
}

/** Binary mask of the pixels of `box` that satisfy `test`. */
export function maskBox(img: RgbaImage, box: Box, test: (p: Rgb) => boolean): Mask {
  const { x0, y0, x1, y1 } = clampBox(img, box);
  const width = x1 - x0;
  const height = y1 - y0;
  const bits = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (test(pixelAt(img, x0 + x, y0 + y))) bits[y * width + x] = 1;
    }
  }
  return { width, height, bits };
}

/** Count of set pixels per row of a mask. */
export function rowCounts(mask: Mask): Uint32Array {
  const out = new Uint32Array(mask.height);
  for (let y = 0; y < mask.height; y++) {
    let n = 0;
    const off = y * mask.width;
    for (let x = 0; x < mask.width; x++) n += mask.bits[off + x];
    out[y] = n;
  }
  return out;
}

/**
 * Clear the rows of a mask that are set over more than `share` of the width (separator bars,
 * panel borders), so text glyphs next to them segment on their own. Returns the same mask.
 */
export function clearWideRows(mask: Mask, share = 0.6): Mask {
  const counts = rowCounts(mask);
  for (let y = 0; y < mask.height; y++) {
    if (counts[y] > mask.width * share) mask.bits.fill(0, y * mask.width, (y + 1) * mask.width);
  }
  return mask;
}

/** Count of set pixels per column of a mask. */
export function columnCounts(mask: Mask): Uint32Array {
  const out = new Uint32Array(mask.width);
  for (let y = 0; y < mask.height; y++) {
    const off = y * mask.width;
    for (let x = 0; x < mask.width; x++) out[x] += mask.bits[off + x];
  }
  return out;
}

export type Run = { start: number; end: number };

/** Maximal runs of consecutive indices whose value is ≥ `threshold` (`end` is exclusive). */
export function runsAbove(values: ArrayLike<number>, threshold: number, minLength = 1): Run[] {
  const runs: Run[] = [];
  let start = -1;
  for (let i = 0; i <= values.length; i++) {
    const on = i < values.length && values[i] >= threshold;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      if (i - start >= minLength) runs.push({ start, end: i });
      start = -1;
    }
  }
  return runs;
}

/** Mean RGB of the pixels of `box` that satisfy `test` (or of every pixel when `test` is omitted). */
export function meanColor(img: RgbaImage, box: Box, test?: (p: Rgb) => boolean): { rgb: Rgb; share: number } {
  const { x0, y0, x1, y1 } = clampBox(img, box);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const total = (x1 - x0) * (y1 - y0);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = pixelAt(img, x, y);
      if (test && !test(p)) continue;
      r += p[0];
      g += p[1];
      b += p[2];
      n++;
    }
  }
  if (n === 0) return { rgb: [0, 0, 0], share: 0 };
  return { rgb: [r / n, g / n, b / n], share: n / total };
}

/** Colour that transparent sprite pixels are composited onto (the dark panel background). */
export const SPRITE_BACKGROUND: Rgb = [36, 28, 20];

/**
 * Area-averaged RGB thumbnail (`size` × `size`, 3 bytes per cell) of `box` — the colour
 * counterpart of `grayThumbnail`, used for awakening and orb icons where hue matters.
 * Transparent pixels (sprite sheets) are composited onto `SPRITE_BACKGROUND` so templates
 * compare like icons drawn on the game's dark panels.
 */
export function rgbThumbnail(img: RgbaImage, box: Box, size: number): Uint8Array {
  const out = new Uint8Array(size * size * 3);
  const [bgR, bgG, bgB] = SPRITE_BACKGROUND;
  const { x0, y0, x1, y1 } = clampBox(img, box);
  const w = x1 - x0;
  const h = y1 - y0;
  for (let cy = 0; cy < size; cy++) {
    const sy0 = y0 + Math.floor((cy * h) / size);
    const sy1 = Math.max(sy0 + 1, y0 + Math.floor(((cy + 1) * h) / size));
    for (let cx = 0; cx < size; cx++) {
      const sx0 = x0 + Math.floor((cx * w) / size);
      const sx1 = Math.max(sx0 + 1, x0 + Math.floor(((cx + 1) * w) / size));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = sy0; y < sy1; y++) {
        for (let x = sx0; x < sx1; x++) {
          const i = (y * img.width + x) * 4;
          const a = img.data[i + 3] / 255;
          r += img.data[i] * a + bgR * (1 - a);
          g += img.data[i + 1] * a + bgG * (1 - a);
          b += img.data[i + 2] * a + bgB * (1 - a);
          n++;
        }
      }
      const o = (cy * size + cx) * 3;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
    }
  }
  return out;
}

/** Bounding box of the opaque pixels inside `box` (sprite tiles have transparent margins); `box` when fully transparent. */
export function opaqueBounds(img: RgbaImage, box: Box, minAlpha = 64): Box {
  const { x0, y0, x1, y1 } = clampBox(img, box);
  let bx0 = x1;
  let by0 = y1;
  let bx1 = x0 - 1;
  let by1 = y0 - 1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] >= minAlpha) {
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
        if (y < by0) by0 = y;
        if (y > by1) by1 = y;
      }
    }
  }
  if (bx1 < bx0 || by1 < by0) return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  return { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 };
}

/** Copy of a sub-rectangle as a standalone image (clamped to the source). */
export function cropImage(img: RgbaImage, box: Box): RgbaImage {
  const { x0, y0, x1, y1 } = clampBox(img, box);
  const width = x1 - x0;
  const height = y1 - y0;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const src = ((y0 + y) * img.width + x0) * 4;
    data.set(img.data.subarray(src, src + width * 4), y * width * 4);
  }
  return { width, height, data };
}
