/**
 * Run the pixel part of the translate pipeline on JP detail-screen screenshots and print what
 * it reads: anchors, numbers, rarity, attributes, awakenings and the known/new decision.
 *
 *   npm run translate-screenshot -- path/to/shot.png [more.png ...]
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIconIndex } from "../web/src/lib/team-build/screenshot/icon-index.ts";
import { readThumbAttributes } from "../web/src/lib/translate/attributes.ts";
import {
  AWAKENING_MIN_SCORE,
  matchAwakeningIcon,
  slotIsEmpty,
  templatesFromStrip,
} from "../web/src/lib/translate/awakening-match.ts";
import { identifyCard } from "../web/src/lib/translate/identify.ts";
import { detectDetailLayout } from "../web/src/lib/translate/layout.ts";
import { countStars } from "../web/src/lib/translate/rarity.ts";
import { readScreenNumbers } from "../web/src/lib/translate/read-numbers.ts";
import { readPngImage } from "./lib/png-image.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: npm run translate-screenshot -- <screenshot.png> [...]");
  process.exit(1);
}

const index = parseIconIndex(new Uint8Array(readFileSync(resolve(root, "web/public/team-build/icon-index.bin"))));
const strip = readPngImage(resolve(root, "web/src/assets/pad/awakenings/awoken.png"));
const templates = templatesFromStrip(strip);

for (const file of files) {
  const img = readPngImage(resolve(file));
  const layout = detectDetailLayout(img);
  const numbers = readScreenNumbers(img, layout);
  const stars = countStars(img, layout.stars, layout.scale);
  const attrs = readThumbAttributes(img, layout.thumb);
  // The header number needs OCR (browser only); the node run identifies by icon alone.
  const ident = identifyCard(img, layout.thumb, index, null);
  const sa = slotIsEmpty(img, layout.superAwakening) ? null : matchAwakeningIcon(img, layout.superAwakening, templates);
  const awakenings = layout.awakenings.map((box) =>
    slotIsEmpty(img, box) ? null : matchAwakeningIcon(img, box, templates)
  );
  const fmt = (m: { id: number; score: number } | null) =>
    m == null ? "·" : `${m.id}${m.score < AWAKENING_MIN_SCORE ? "?" : ""}(${m.score.toFixed(2)})`;
  const num = (r: { text: string; value: number | null; confidence: number }) =>
    `${r.value ?? "null"}[${r.text} ${r.confidence.toFixed(2)}]`;
  console.log(
    [
      `${file} ${img.width}x${img.height} headerTop=${layout.headerTop}${layout.headerFallback ? "(fallback)" : ""} statsTop=${layout.statsTop}${layout.statsFallback ? "(fallback)" : ""}`,
      `  stars=${stars} attrs=${attrs.attribute1}/${attrs.attribute2}/${attrs.attribute3}`,
      `  hp=${num(numbers.hp)} atk=${num(numbers.atk)} rcv=${num(numbers.rcv)} plus=${numbers.plusHp.value}/${numbers.plusAtk.value}/${numbers.plusRcv.value}`,
      `  level=${num(numbers.level)} maxLevel=${num(numbers.maxLevel)} cost=${num(numbers.cost)} turns=${num(numbers.turns)}`,
      `  identify=${ident.kind} id=${ident.id} icon=${ident.iconScore.toFixed(3)} number=${ident.numberScore?.toFixed(3) ?? "-"} top=${ident.candidates.map((c) => `${c.id}:${c.score.toFixed(2)}`).join(" ")} ${ident.flags.join("; ")}`,
      `  SA=${fmt(sa)} awakenings=${awakenings.map(fmt).join(" ")}`,
    ].join("\n")
  );
}
