import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { readPngImage } from "../../../../scripts/lib/png-image.ts";
import { readThumbAttributes } from "./attributes.ts";
import {
  AWAKENING_MIN_SCORE,
  matchAwakeningIcon,
  slotIsEmpty,
  templatesFromStrip,
} from "./awakening-match.ts";
import {
  AWAKENING_SLOTS,
  detectDetailLayout,
  layoutFromAnchors,
  REFERENCE_HEADER_TOP,
  REFERENCE_STATS_TOP,
  REFERENCE_WIDTH,
} from "./layout.ts";
import { countStars } from "./rarity.ts";

const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");
const assets = resolve(dirname(fileURLToPath(import.meta.url)), "../../assets/pad/awakenings");

function fixture(name: string) {
  return readPngImage(resolve(fixtures, name));
}

describe("detectDetailLayout", () => {
  it("finds both anchors on the downscaled samples", () => {
    // Reference rows 24 / 1477 (sample 1) and 34 / 1487 (sample 4) at 414 / 1242 scale.
    const a = detectDetailLayout(fixture("sample1-full-414.png"));
    assert.equal(a.headerFallback, false);
    assert.equal(a.statsFallback, false);
    assert.ok(Math.abs(a.headerTop - 8) <= 1, `headerTop ${a.headerTop}`);
    assert.ok(Math.abs(a.statsTop - 492) <= 2, `statsTop ${a.statsTop}`);
    const b = detectDetailLayout(fixture("sample4-full-414.png"));
    assert.ok(Math.abs(b.headerTop - 11) <= 1, `headerTop ${b.headerTop}`);
    assert.ok(Math.abs(b.statsTop - 496) <= 2, `statsTop ${b.statsTop}`);
  });

  it("falls back to the reference rows on a blank image", () => {
    const blank = { width: 621, height: 1100, data: new Uint8Array(621 * 1100 * 4) };
    const l = detectDetailLayout(blank);
    assert.equal(l.headerFallback, true);
    assert.equal(l.statsFallback, true);
    assert.equal(l.headerTop, REFERENCE_HEADER_TOP / 2);
    assert.equal(l.statsTop, REFERENCE_STATS_TOP / 2);
  });

  it("scales every box with the width and keeps nine awakening slots", () => {
    const l = layoutFromAnchors(REFERENCE_WIDTH * 2, 4400, 48, 2954);
    assert.equal(l.scale, 2);
    assert.equal(l.awakenings.length, AWAKENING_SLOTS);
    assert.equal(Math.round(l.thumb.w), 392);
    assert.ok(l.awakenings[1].y > l.awakenings[0].y);
  });
});

describe("rarity and attributes on the downscaled samples", () => {
  it("counts 8 stars for Pochacco and 9 for Kuromi & Baku", () => {
    const a = fixture("sample1-full-414.png");
    const la = detectDetailLayout(a);
    assert.equal(countStars(a, la.stars, la.scale), 8);
    const b = fixture("sample4-full-414.png");
    const lb = detectDetailLayout(b);
    assert.equal(countStars(b, lb.stars, lb.scale), 9);
  });

  it("reads the orbs of the thumbnail at 414 px", () => {
    const b = fixture("sample4-full-414.png");
    const lb = detectDetailLayout(b);
    assert.deepEqual(readThumbAttributes(b, lb.thumb), { attribute1: 2, attribute2: 2, attribute3: 4 });
  });
});

describe("awakening matching against the sprite strip", () => {
  const templates = templatesFromStrip(readPngImage(resolve(assets, "awoken.png")));

  it("builds one template per strip row", () => {
    assert.ok(templates.ids.length >= 148, `only ${templates.ids.length} templates`);
    assert.equal(templates.ids[0], 0);
  });

  it("recognises the awakening column of Pochacco (8 awakenings + an empty slot)", () => {
    const img = fixture("sample1-full-414.png");
    const layout = detectDetailLayout(img);
    const ids = layout.awakenings.map((box) =>
      slotIsEmpty(img, box) ? null : matchAwakeningIcon(img, box, templates)
    );
    assert.deepEqual(
      ids.map((m) => m?.id ?? null),
      [52, 145, 28, 59, 121, 144, 144, 132, null]
    );
    for (const m of ids) if (m) assert.ok(m.score >= AWAKENING_MIN_SCORE, `score ${m.score}`);
    const sa = matchAwakeningIcon(img, layout.superAwakening, templates);
    assert.equal(sa.id, 127);
  });

  it("recognises the awakening column of Kuromi & Baku (9 awakenings)", () => {
    const img = fixture("sample4-full-414.png");
    const layout = detectDetailLayout(img);
    const ids = layout.awakenings.map((box) => matchAwakeningIcon(img, box, templates).id);
    assert.deepEqual(ids, [52, 145, 146, 136, 68, 151, 111, 111, 131]);
  });
});
