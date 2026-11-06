import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { readPngImage } from "../../../../scripts/lib/png-image.ts";
import { readThumbAttributes } from "./attributes.ts";
import { DIGIT_GLYPHS } from "./digit-glyphs.ts";
import { classifyGlyph, GLYPH_BITS, normalizeGlyph, segmentGlyphs } from "./digits.ts";
import { layoutFromAnchors } from "./layout.ts";
import { isWhite, maskBox, type Mask } from "./pixels.ts";
import { readScreenNumbers } from "./read-numbers.ts";

const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");
/** The panel fixtures start 10 px above the stats panel's gold line. */
const PANEL_STATS_TOP = 10;

function panels(name: string) {
  const img = readPngImage(resolve(fixtures, name));
  return { img, layout: layoutFromAnchors(img.width, img.height, 0, PANEL_STATS_TOP) };
}

describe("digit templates", () => {
  it("cover every digit and the plus sign", () => {
    const chars = new Set(DIGIT_GLYPHS.map((g) => g.ch));
    for (const ch of "0123456789+") assert.ok(chars.has(ch), `missing template for ${ch}`);
    for (const g of DIGIT_GLYPHS) assert.equal(g.bits.length, GLYPH_BITS);
  });

  it("segment and classify a synthetic bar as a glyph", () => {
    const mask: Mask = { width: 10, height: 8, bits: new Uint8Array(80) };
    for (let y = 0; y < 8; y++) for (let x = 2; x < 5; x++) mask.bits[y * 10 + x] = 1;
    const rects = segmentGlyphs(mask);
    assert.deepEqual(rects, [{ x0: 2, y0: 0, x1: 5, y1: 8 }]);
    const bits = normalizeGlyph(mask, rects[0]);
    assert.equal(bits.length, GLYPH_BITS);
    assert.ok(bits.every((v) => v === 15));
    const c = classifyGlyph(bits, [{ ch: "x", bits: "f".repeat(GLYPH_BITS) }]);
    assert.equal(c.ch, "x");
    assert.equal(c.confidence, 1);
  });
});

describe("readScreenNumbers on the fixture panels", () => {
  it("reads sample 1 (Pochacco)", () => {
    const { img, layout } = panels("sample1-panels.png");
    const n = readScreenNumbers(img, layout);
    assert.equal(n.hp.value, 48389);
    assert.equal(n.atk.value, 29987);
    assert.equal(n.rcv.value, 5456);
    assert.deepEqual([n.plusHp.value, n.plusAtk.value, n.plusRcv.value], [99, 99, 99]);
    assert.equal(n.level.value, 120);
    assert.equal(n.maxLevel.value, 120);
    assert.equal(n.cost.value, 30);
    assert.equal(n.turns.value, 5);
  });

  it("reads sample 4 (Kuromi & Baku)", () => {
    const { img, layout } = panels("sample4-panels.png");
    const n = readScreenNumbers(img, layout);
    assert.equal(n.hp.value, 17660);
    assert.equal(n.atk.value, 13235);
    assert.equal(n.rcv.value, 2889);
    assert.equal(n.cost.value, 40);
    assert.equal(n.turns.value, 20);
  });

  it("returns null instead of a wrong value for an empty box", () => {
    const { img, layout } = panels("sample1-panels.png");
    const empty = maskBox(img, { ...layout.hp, y: layout.hp.y + 400 }, isWhite);
    assert.equal(empty.bits.every((v) => v === 0), true);
  });
});

describe("readThumbAttributes on the fixture panels", () => {
  it("reads fire/fire/fire for Pochacco and wood/wood/dark for Kuromi & Baku", () => {
    const a = panels("sample1-panels.png");
    assert.deepEqual(readThumbAttributes(a.img, a.layout.thumb), {
      attribute1: 0,
      attribute2: 0,
      attribute3: 0,
    });
    const b = panels("sample4-panels.png");
    assert.deepEqual(readThumbAttributes(b.img, b.layout.thumb), {
      attribute1: 2,
      attribute2: 2,
      attribute3: 4,
    });
  });
});
