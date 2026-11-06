import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Box } from "./descriptor.ts";
import {
  boxesForRow,
  candidateRows,
  EDIT_TEAM_LAYOUT,
  frameBoxesForRow,
  HELPER_SLOT,
  refineBox,
  type GrayImage,
} from "./layout.ts";

const WIDTH = 1000;
const HEIGHT = 1800;
const ROW_Y = 700;
const FRAME = 6;

function blank(): GrayImage {
  return { width: WIDTH, height: HEIGHT, data: new Uint8Array(WIDTH * HEIGHT).fill(60) };
}

function drawFrame(g: GrayImage, box: Box, value = 230): void {
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const onFrame =
        x < box.x + FRAME ||
        x >= box.x + box.w - FRAME ||
        y < box.y + FRAME ||
        y >= box.y + box.h - FRAME;
      if (onFrame && x >= 0 && x < g.width && y >= 0 && y < g.height) {
        g.data[y * g.width + x] = value;
      }
    }
  }
}

describe("edit-team layout detection", () => {
  it("lays the icons and the helper out relative to the width", () => {
    const frames = frameBoxesForRow(EDIT_TEAM_LAYOUT, WIDTH, ROW_Y);
    const { cards, assists } = boxesForRow(EDIT_TEAM_LAYOUT, WIDTH, ROW_Y);
    assert.equal(frames.length, 5);
    assert.equal(cards.length, 6);
    assert.ok(cards.slice(0, 5).every((c) => c.w === c.h && c.w < frames[0].w));
    assert.ok(cards.slice(0, 5).every((c, i) => Math.abs(c.x - frames[i].x) < frames[0].w / 4));
    assert.ok(cards[HELPER_SLOT].y < ROW_Y);
    assert.equal(assists[HELPER_SLOT], null);
    assert.ok(assists.slice(0, 5).every((a) => a && a.x > 0 && a.w < cards[0].w));
  });

  it("finds the row of five framed cards, not a decoy row of three", () => {
    const g = blank();
    for (const c of frameBoxesForRow(EDIT_TEAM_LAYOUT, WIDTH, ROW_Y)) drawFrame(g, c);
    for (const c of frameBoxesForRow(EDIT_TEAM_LAYOUT, WIDTH, 1300).slice(0, 3)) {
      drawFrame(g, c);
    }
    const rows = candidateRows(g, EDIT_TEAM_LAYOUT);
    assert.ok(rows.length >= 1);
    assert.ok(Math.abs(rows[0] - ROW_Y) <= 2, `best row ${rows[0]} vs ${ROW_Y}`);
  });

  it("nudges a box back onto its frame", () => {
    const g = blank();
    const box = frameBoxesForRow(EDIT_TEAM_LAYOUT, WIDTH, ROW_Y)[2];
    drawFrame(g, box);
    const shifted = { ...box, x: box.x + 5, y: box.y - 4 };
    const refined = refineBox(g, shifted, 8);
    assert.ok(Math.abs(refined.x - box.x) <= 1 && Math.abs(refined.y - box.y) <= 1);
  });
});
