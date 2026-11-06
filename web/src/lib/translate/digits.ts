/**
 * Reads the numbers printed on the JP detail screen (HP / ATK / RCV, +99, level, cost, skill
 * turns) by template matching. PAD draws every number in one fixed bitmap font, so a binary
 * mask of the text, split into glyphs at empty columns and resampled to a small grid, matches
 * a handful of committed templates far more reliably than a general OCR engine.
 */
import { columnCounts, type Mask } from "./pixels.ts";

export const GLYPH_W = 16;
export const GLYPH_H = 24;
export const GLYPH_BITS = GLYPH_W * GLYPH_H;
/** Coverage levels per cell (stored as one hex digit each). */
export const GLYPH_LEVELS = 16;

/**
 * One labelled glyph; `bits` is a string of `GLYPH_BITS` hex digits, row-major, each the
 * share (0–15) of the cell covered by ink.
 */
export type GlyphTemplate = { ch: string; bits: string };

export type GlyphRect = { x0: number; y0: number; x1: number; y1: number };

/** Minimum template agreement for a glyph to be accepted. */
export const GLYPH_MIN_CONFIDENCE = 0.85;

/**
 * Glyph bounding boxes of a text mask, left to right: runs of non-empty columns, each shrunk
 * to its occupied rows. Specks smaller than 3×3 are dropped.
 */
export function segmentGlyphs(mask: Mask): GlyphRect[] {
  const cols = columnCounts(mask);
  const rects: GlyphRect[] = [];
  let start = -1;
  for (let x = 0; x <= mask.width; x++) {
    const on = x < mask.width && cols[x] > 0;
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      let y0 = mask.height;
      let y1 = -1;
      for (let y = 0; y < mask.height; y++) {
        const off = y * mask.width;
        for (let xx = start; xx < x; xx++) {
          if (mask.bits[off + xx]) {
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
            break;
          }
        }
      }
      if (y1 >= 0 && (x - start >= 3 || y1 - y0 + 1 >= 3)) {
        rects.push({ x0: start, y0, x1: x, y1: y1 + 1 });
      }
      start = -1;
    }
  }
  return rects;
}

/** Resample the glyph inside `rect` to the `GLYPH_W` × `GLYPH_H` grid of coverage levels (0–15). */
export function normalizeGlyph(mask: Mask, rect: GlyphRect): Uint8Array {
  const out = new Uint8Array(GLYPH_BITS);
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  for (let gy = 0; gy < GLYPH_H; gy++) {
    const sy0 = rect.y0 + Math.floor((gy * h) / GLYPH_H);
    const sy1 = Math.max(sy0 + 1, rect.y0 + Math.floor(((gy + 1) * h) / GLYPH_H));
    for (let gx = 0; gx < GLYPH_W; gx++) {
      const sx0 = rect.x0 + Math.floor((gx * w) / GLYPH_W);
      const sx1 = Math.max(sx0 + 1, rect.x0 + Math.floor(((gx + 1) * w) / GLYPH_W));
      let set = 0;
      let n = 0;
      for (let y = sy0; y < sy1; y++) {
        for (let x = sx0; x < sx1; x++) {
          set += mask.bits[y * mask.width + x];
          n++;
        }
      }
      out[gy * GLYPH_W + gx] = Math.round(((GLYPH_LEVELS - 1) * set) / n);
    }
  }
  return out;
}

export function glyphBitsToString(bits: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bits.length; i++) s += bits[i].toString(16);
  return s;
}

function hexLevel(code: number): number {
  // "0"–"9" → 0–9, "a"–"f" → 10–15
  return code <= 57 ? code - 48 : code - 87;
}

/** A glyph is accepted below `GLYPH_MIN_CONFIDENCE` when it still beats every other character by this much. */
export const GLYPH_MIN_MARGIN = 0.04;
export const GLYPH_MARGIN_MIN_CONFIDENCE = 0.72;

export type GlyphClass = {
  ch: string;
  /** 1 − mean absolute coverage difference to the nearest template. */
  confidence: number;
  /** Confidence lead over the nearest template of a different character. */
  margin: number;
};

/** Nearest template by mean absolute coverage difference. */
export function classifyGlyph(bits: Uint8Array, templates: ReadonlyArray<GlyphTemplate>): GlyphClass {
  const maxDist = GLYPH_BITS * (GLYPH_LEVELS - 1);
  const bestByChar = new Map<string, number>();
  for (const t of templates) {
    let d = 0;
    for (let i = 0; i < GLYPH_BITS; i++) d += Math.abs(hexLevel(t.bits.charCodeAt(i)) - bits[i]);
    const prev = bestByChar.get(t.ch);
    if (prev == null || d < prev) bestByChar.set(t.ch, d);
  }
  let best = "?";
  let bestDist = Infinity;
  let second = Infinity;
  for (const [ch, d] of bestByChar) {
    if (d < bestDist) {
      second = bestDist;
      bestDist = d;
      best = ch;
    } else if (d < second) {
      second = d;
    }
  }
  if (!Number.isFinite(bestDist)) return { ch: "?", confidence: 0, margin: 0 };
  const confidence = 1 - bestDist / maxDist;
  const margin = Number.isFinite(second) ? (second - bestDist) / maxDist : 1;
  return { ch: best, confidence, margin };
}

/**
 * Classify the glyph in `rect`, also trying the rectangle shifted by one pixel in each
 * direction: the bounding box of an anti-aliased glyph lands a pixel off now and then, which
 * costs several points of confidence against the template grid.
 */
export function classifyGlyphAt(
  mask: Mask,
  rect: GlyphRect,
  templates: ReadonlyArray<GlyphTemplate>
): GlyphClass {
  let best: GlyphClass = { ch: "?", confidence: -1, margin: 0 };
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const shifted: GlyphRect = {
        x0: Math.max(0, rect.x0 + dx),
        y0: Math.max(0, rect.y0 + dy),
        x1: Math.min(mask.width, rect.x1 + dx),
        y1: Math.min(mask.height, rect.y1 + dy),
      };
      if (shifted.x1 <= shifted.x0 || shifted.y1 <= shifted.y0) continue;
      const c = classifyGlyph(normalizeGlyph(mask, shifted), templates);
      if (c.confidence > best.confidence) best = c;
    }
  }
  return best;
}

/** Accept a classification when it is confident, or decisive enough despite a lower score. */
export function glyphAccepted(c: GlyphClass): boolean {
  return (
    c.confidence >= GLYPH_MIN_CONFIDENCE ||
    (c.confidence >= GLYPH_MARGIN_MIN_CONFIDENCE && c.margin >= GLYPH_MIN_MARGIN)
  );
}

/**
 * Glyph rectangles that can be a digit or a plus sign: at least 45 % of the tallest glyph,
 * starting in the upper part of the line (a comma hangs below the baseline) and not a thin
 * parenthesis or colon.
 */
export function digitCandidates(rects: GlyphRect[]): GlyphRect[] {
  let maxH = 0;
  let top = Infinity;
  for (const r of rects) {
    maxH = Math.max(maxH, r.y1 - r.y0);
    top = Math.min(top, r.y0);
  }
  return rects.filter((r) => {
    const h = r.y1 - r.y0;
    const w = r.x1 - r.x0;
    return h >= maxH * 0.45 && r.y0 - top <= maxH * 0.4 && w >= h * 0.3;
  });
}

export type DigitsReadout = {
  /** Recognised characters in reading order ("?" for a glyph below the confidence floor). */
  text: string;
  /** Integer value of the digits, or null when nothing was read or a glyph was uncertain. */
  value: number | null;
  /** Lowest glyph confidence (1 when no glyph was read). */
  confidence: number;
};

/** Read one number from a binary text mask. */
export function readDigits(mask: Mask, templates: ReadonlyArray<GlyphTemplate>): DigitsReadout {
  const rects = digitCandidates(segmentGlyphs(mask));
  let text = "";
  let confidence = 1;
  let uncertain = false;
  for (const rect of rects) {
    const c = classifyGlyphAt(mask, rect, templates);
    confidence = Math.min(confidence, c.confidence);
    if (!glyphAccepted(c)) {
      text += "?";
      uncertain = true;
    } else {
      text += c.ch;
    }
  }
  const digits = text.replace(/[^0-9]/g, "");
  const value = !uncertain && digits.length > 0 ? Number.parseInt(digits, 10) : null;
  return { text, value, confidence: rects.length ? confidence : 1 };
}

/**
 * Read a right-aligned number that follows a label in the same colour ("コスト: 30",
 * "ターン:20"): the value is the run of confident digits at the end of the text.
 */
export function readTrailingDigits(mask: Mask, templates: ReadonlyArray<GlyphTemplate>): DigitsReadout {
  const rects = digitCandidates(segmentGlyphs(mask));
  let text = "";
  let confidence = 1;
  for (const rect of rects) {
    const c = classifyGlyphAt(mask, rect, templates);
    if (!glyphAccepted(c) || !/[0-9]/.test(c.ch)) {
      text += "?";
    } else {
      text += c.ch;
      confidence = Math.min(confidence, c.confidence);
    }
  }
  const trailing = /([0-9]+)$/.exec(text)?.[1] ?? "";
  return {
    text,
    value: trailing ? Number.parseInt(trailing, 10) : null,
    confidence: trailing ? confidence : 0,
  };
}

/** Read a "(+99)" style bonus: the digits that follow the plus sign (null when there is no plus). */
export function readPlusBonus(mask: Mask, templates: ReadonlyArray<GlyphTemplate>): DigitsReadout {
  const readout = readDigits(mask, templates);
  const plus = readout.text.indexOf("+");
  if (plus < 0) return { text: readout.text, value: null, confidence: readout.confidence };
  const after = readout.text.slice(plus + 1);
  const digits = after.replace(/[^0-9]/g, "");
  const uncertain = after.includes("?");
  return {
    text: readout.text,
    value: !uncertain && digits.length ? Number.parseInt(digits, 10) : null,
    confidence: readout.confidence,
  };
}
