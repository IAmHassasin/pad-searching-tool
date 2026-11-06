/**
 * Generate `web/src/lib/translate/digit-glyphs.ts` from the committed fixture crops of the
 * JP detail screen. Each fixture box is paired with the characters it is known to show; the
 * glyphs are segmented exactly as the browser does it and stored as 12×16 bit strings.
 *
 *   npm run digit-glyphs
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Box } from "../web/src/lib/team-build/screenshot/descriptor.ts";
import {
  digitCandidates,
  glyphBitsToString,
  normalizeGlyph,
  segmentGlyphs,
  type GlyphTemplate,
} from "../web/src/lib/translate/digits.ts";
import { layoutFromAnchors, type DetailLayout } from "../web/src/lib/translate/layout.ts";
import { isTeal, isWhite, isYellow, maskBox, type Rgb } from "../web/src/lib/translate/pixels.ts";
import { readPngImage } from "./lib/png-image.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = resolve(root, "web/src/lib/translate/fixtures");
const output = resolve(root, "web/src/lib/translate/digit-glyphs.ts");

/** The panel fixtures start 10 px above the stats panel's gold line. */
const PANEL_STATS_TOP = 10;

type Sample = {
  file: string;
  boxes: Array<{ key: keyof DetailLayout; expected: string; colour: (p: Rgb) => boolean }>;
};

const SAMPLES: Sample[] = [
  {
    file: "sample1-panels.png",
    boxes: [
      { key: "hp", expected: "48389", colour: isWhite },
      { key: "atk", expected: "29987", colour: isWhite },
      { key: "rcv", expected: "5456", colour: isWhite },
      { key: "plusHp", expected: "+99", colour: isYellow },
      { key: "level", expected: "120", colour: isTeal },
      { key: "maxLevel", expected: "120", colour: isTeal },
      { key: "cost", expected: "30", colour: isWhite },
      { key: "turns", expected: "5", colour: isWhite },
    ],
  },
  {
    file: "sample4-panels.png",
    boxes: [
      { key: "hp", expected: "17660", colour: isWhite },
      { key: "atk", expected: "13235", colour: isWhite },
      { key: "rcv", expected: "2889", colour: isWhite },
      { key: "plusRcv", expected: "+99", colour: isYellow },
      { key: "cost", expected: "40", colour: isWhite },
      { key: "turns", expected: "20", colour: isWhite },
    ],
  },
];

const templates: GlyphTemplate[] = [];
for (const sample of SAMPLES) {
  const img = readPngImage(resolve(fixtures, sample.file));
  const layout = layoutFromAnchors(img.width, img.height, 0, PANEL_STATS_TOP);
  for (const { key, expected, colour } of sample.boxes) {
    const box = layout[key] as Box;
    const mask = maskBox(img, box, colour);
    const rects = digitCandidates(segmentGlyphs(mask));
    if (rects.length < expected.length) {
      throw new Error(
        `${sample.file}/${key}: expected ${expected.length} glyphs for "${expected}", found ${rects.length}`
      );
    }
    // Labels in the same colour may precede the number; the value is right-aligned.
    const used = rects.slice(rects.length - expected.length);
    used.forEach((rect, i) => {
      templates.push({ ch: expected[i], bits: glyphBitsToString(normalizeGlyph(mask, rect)) });
    });
  }
}

/**
 * Digits of the skill-description font (popup and skill panels), taken from text-line strips
 * (full panel width, 48 px, cut 2 px above the line). Each digit is named by the x position
 * of its glyph in the strip (image x − 28); the nearest glyph rectangle is used.
 */
type TextLineSample = { file: string; digits: Array<[x: number, ch: string]> };

const TEXT_LINE_SAMPLES: TextLineSample[] = [
  // "35ターンの間、右隣のダメージ上限値が250億。"
  { file: "text-line-7-1453.png", digits: [[113, "3"], [138, "5"], [924, "2"], [950, "5"], [974, "0"]] },
  // "上限値が250億。[lock]を解除し、右端1列を[wood]に変化。"
  { file: "text-line-7-1670.png", digits: [[299, "2"], [325, "5"], [350, "0"], [842, "1"]] },
  // "Lv.1 ターン:24 (最大Lv.5 ターン:20)"
  { file: "text-line-7-1406.png", digits: [[129, "1"], [320, "2"], [355, "4"], [602, "5"], [802, "2"], [838, "0"]] },
  // "8ターンの間、自分の攻撃力が3倍、ダメージ上限値が300億。"
  { file: "text-line-5-1252.png", digits: [[112, "8"], [1043, "3"], [1063, "0"], [1085, "0"]] },
  // "8ターンの間、最大HPが1.5倍、[type]の攻撃力が3倍。"
  { file: "text-line-5-1412.png", digits: [[112, "8"], [582, "1"], [607, "5"], [974, "3"]] },
];

for (const sample of TEXT_LINE_SAMPLES) {
  const img = readPngImage(resolve(fixtures, sample.file));
  const mask = maskBox(img, { x: 0, y: 0, w: img.width, h: img.height }, isWhite);
  const rects = digitCandidates(segmentGlyphs(mask).filter((r) => r.y1 - r.y0 >= 20));
  for (const [x, ch] of sample.digits) {
    let best = rects[0];
    for (const r of rects) if (Math.abs(r.x0 - x) < Math.abs(best.x0 - x)) best = r;
    if (!best || Math.abs(best.x0 - x) > 6) {
      throw new Error(`${sample.file}: no glyph near x=${x} for "${ch}"`);
    }
    templates.push({ ch, bits: glyphBitsToString(normalizeGlyph(mask, best)) });
  }
}

const seen = new Set<string>();
const unique = templates.filter((t) => {
  const key = `${t.ch}:${t.bits}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const lines = [
  "/** Generated by `npm run digit-glyphs` from the fixture crops — do not edit by hand. */",
  'import type { GlyphTemplate } from "./digits.ts";',
  "",
  "export const DIGIT_GLYPHS: ReadonlyArray<GlyphTemplate> = [",
  ...unique.map((t) => `  { ch: ${JSON.stringify(t.ch)}, bits: "${t.bits}" },`),
  "];",
  "",
];
writeFileSync(output, lines.join("\n"));
const counts = new Map<string, number>();
for (const t of unique) counts.set(t.ch, (counts.get(t.ch) ?? 0) + 1);
console.log(`Wrote ${unique.length} glyph templates: ${[...counts].map(([c, n]) => `${c}×${n}`).join(" ")}`);
