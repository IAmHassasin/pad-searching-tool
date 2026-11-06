/**
 * Dev check for the screenshot importer: runs the matcher on a PNG and prints the detected row
 * and the ranked candidates per slot, exactly as the browser would see them.
 *
 * Usage: npm run screenshot-match -- <screenshot.png> [icon-index.bin]
 */
import { readFile } from "node:fs/promises";
import pngjs from "pngjs";
import { parseIconIndex } from "../web/src/lib/team-build/screenshot/icon-index.ts";
import {
  assistSuggestions,
  matchScreenshot,
  preselectedCandidate,
} from "../web/src/lib/team-build/screenshot/match.ts";

const { PNG } = pngjs;
const LABELS = ["leader", "sub1", "sub2", "sub3", "sub4", "helper"];

const [, , imagePath, indexPath = "web/public/team-build/icon-index.bin"] =
  process.argv;
if (!imagePath) {
  console.error("Usage: npm run screenshot-match -- <screenshot.png> [icon-index.bin]");
  process.exit(1);
}

const png = PNG.sync.read(await readFile(imagePath));
const index = parseIconIndex(await readFile(indexPath));
const started = performance.now();
const match = matchScreenshot(
  { width: png.width, height: png.height, data: png.data },
  index
);
console.log(
  `${png.width}x${png.height}, index ${index.count} icons, matched in ${(performance.now() - started).toFixed(0)} ms`
);
if (!match) {
  console.log("No team row detected.");
  process.exit(2);
}
const fmt = (c: { id: number; score: number }) => `${c.id}:${c.score.toFixed(2)}`;
console.log(`row y=${match.rowY} score=${match.score.toFixed(3)}`);
for (const slot of match.slots) {
  const pre = preselectedCandidate(slot.candidates);
  console.log(
    `${LABELS[slot.slotIndex].padEnd(6)} box=${slot.box.x},${slot.box.y},${slot.box.w} ` +
      `pre=${pre?.id ?? "-"} | ${slot.candidates.map(fmt).join(" ")}`
  );
  if (slot.assistBox) {
    const shown = assistSuggestions(slot.assistCandidates).map(fmt).join(" ") || "-";
    console.log(
      `       assist shown: ${shown} | all: ${slot.assistCandidates.map(fmt).join(" ")}`
    );
  }
}
