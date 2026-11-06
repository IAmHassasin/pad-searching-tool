import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL_CELLS,
  CARD_DESCRIPTOR_LENGTH,
  cardDescriptor,
  correlation,
  DESCRIPTOR_SIZE,
  grayThumbnail,
  maskedCorrelation,
  TEAM_CARD_CELLS,
  type RgbaImage,
} from "./descriptor.ts";

function image(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number]
): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("screenshot descriptor", () => {
  it("averages a flat image to a constant thumbnail", () => {
    const img = image(50, 50, () => [100, 100, 100]);
    const thumb = grayThumbnail(img, { x: 0, y: 0, w: 50, h: 50 });
    assert.equal(thumb.length, DESCRIPTOR_SIZE * DESCRIPTOR_SIZE);
    assert.ok(thumb.every((v) => v === 100));
  });

  it("keeps left/right structure", () => {
    const img = image(64, 64, (x) => (x < 32 ? [0, 0, 0] : [255, 255, 255]));
    const thumb = grayThumbnail(img, { x: 0, y: 0, w: 64, h: 64 });
    assert.equal(thumb[0], 0);
    assert.equal(thumb[DESCRIPTOR_SIZE - 1], 255);
    assert.equal(thumb[DESCRIPTOR_SIZE * 5 + 7], 0);
    assert.equal(thumb[DESCRIPTOR_SIZE * 5 + 8], 255);
  });

  it("clamps a box that sticks out of the image", () => {
    const img = image(20, 20, () => [10, 20, 30]);
    const thumb = grayThumbnail(img, { x: -15, y: 10, w: 40, h: 40 });
    assert.ok(thumb.every((v) => Number.isFinite(v) && v === thumb[0]));
  });

  it("card descriptor is the top rows only", () => {
    const img = image(32, 32, (_x, y) => (y < 20 ? [200, 200, 200] : [0, 0, 0]));
    const desc = cardDescriptor(grayThumbnail(img, { x: 0, y: 0, w: 32, h: 32 }));
    assert.equal(desc.length, CARD_DESCRIPTOR_LENGTH);
    assert.ok(desc.every((v) => v === 200));
  });

  it("correlation is 1 for identical, -1 for inverted, 0 for constant input", () => {
    const a = [1, 2, 3, 4, 5];
    assert.ok(Math.abs(correlation(a, a) - 1) < 1e-12);
    assert.ok(Math.abs(correlation(a, [5, 4, 3, 2, 1]) + 1) < 1e-12);
    assert.equal(correlation(a, [7, 7, 7, 7, 7]), 0);
  });

  it("team card cells skip the orb and badge areas and stay inside the descriptor", () => {
    const cell = (x: number, y: number) => y * DESCRIPTOR_SIZE + x;
    const cells = new Set(TEAM_CARD_CELLS);
    assert.equal(ALL_CELLS.length, CARD_DESCRIPTOR_LENGTH);
    assert.ok(TEAM_CARD_CELLS.length < ALL_CELLS.length);
    assert.ok(TEAM_CARD_CELLS.every((c, i) => c < CARD_DESCRIPTOR_LENGTH && (i === 0 || c > TEAM_CARD_CELLS[i - 1])));
    assert.ok(!cells.has(cell(0, 0)), "attribute orb corner");
    assert.ok(!cells.has(cell(12, 2)), "awakening badges");
    assert.ok(cells.has(cell(5, 0)), "top edge between orb and badges");
    assert.ok(cells.has(cell(0, 4)));
    assert.ok(cells.has(cell(15, 9)));
  });

  it("masked correlation ignores the cells outside the mask", () => {
    const a = Uint8Array.from({ length: CARD_DESCRIPTOR_LENGTH }, (_, i) => (i * 37) % 256);
    const b = Uint8Array.from(a);
    for (let i = 0; i < CARD_DESCRIPTOR_LENGTH; i++) {
      if (!TEAM_CARD_CELLS.includes(i)) b[i] = 255 - b[i];
    }
    assert.ok(Math.abs(maskedCorrelation(a, b, TEAM_CARD_CELLS) - 1) < 1e-12);
    assert.ok(correlation(a, b) < 0.9);
    assert.equal(maskedCorrelation(a, b, new Uint16Array()), 0);
  });
});
