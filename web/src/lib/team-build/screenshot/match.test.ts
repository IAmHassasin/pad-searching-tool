import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyScreenshotSelections } from "./apply.ts";
import {
  cardDescriptor,
  grayThumbnail,
  TEAM_CARD_CELLS,
  type Box,
  type RgbaImage,
} from "./descriptor.ts";
import { encodeIconIndex, parseIconIndex } from "./icon-index.ts";
import { boxesForRow, EDIT_TEAM_LAYOUT, frameBoxesForRow } from "./layout.ts";
import {
  alignBoxToCandidates,
  assistSuggestions,
  matchScreenshot,
  needsReview,
  preselectedCandidate,
  withKnownCandidates,
} from "./match.ts";
import { emptyMember } from "../types.ts";

const WIDTH = 1000;
const HEIGHT = 1800;
const ROW_Y = 700;
const ICON = 100;
const BLOCK = 20;
const FRAME = 6;

/** Deterministic block-noise "icon" so area averaging keeps its structure. */
function texture(seed: number): RgbaImage {
  const data = new Uint8Array(ICON * ICON * 4);
  const cells = ICON / BLOCK;
  const values: number[] = [];
  let s = seed * 7919 + 17;
  for (let i = 0; i < cells * cells; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    values.push(40 + (s % 180));
  }
  for (let y = 0; y < ICON; y++) {
    for (let x = 0; x < ICON; x++) {
      const v = values[Math.floor(y / BLOCK) * cells + Math.floor(x / BLOCK)];
      const i = (y * ICON + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width: ICON, height: ICON, data };
}

function fill(target: RgbaImage, box: Box, value: number) {
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const t = (y * target.width + x) * 4;
      target.data[t] = value;
      target.data[t + 1] = value;
      target.data[t + 2] = value;
      target.data[t + 3] = 255;
    }
  }
}

function paint(target: RgbaImage, icon: RgbaImage, box: Box) {
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const sx = Math.floor((x * icon.width) / box.w);
      const sy = Math.floor((y * icon.height) / box.h);
      const s = (sy * icon.width + sx) * 4;
      const t = ((box.y + y) * target.width + box.x + x) * 4;
      target.data[t] = icon.data[s];
      target.data[t + 1] = icon.data[s + 1];
      target.data[t + 2] = icon.data[s + 2];
      target.data[t + 3] = 255;
    }
  }
}

describe("screenshot matcher", () => {
  const teamIds = [1201, 1202, 1203, 1204, 1205, 1206];
  const icons = new Map<number, RgbaImage>();
  for (let i = 0; i < 40; i++) icons.set(1201 + i, texture(i + 1));
  const index = parseIconIndex(
    encodeIconIndex(
      [...icons].map(([id, img]) => ({
        id,
        descriptor: cardDescriptor(
          grayThumbnail(img, { x: 0, y: 0, w: ICON, h: ICON })
        ),
      }))
    )
  );

  // Bright frames (row detection) with the icon art painted inside, like the real screen.
  const screenshot: RgbaImage = {
    width: WIDTH,
    height: HEIGHT,
    data: new Uint8Array(WIDTH * HEIGHT * 4).fill(70),
  };
  for (const frame of frameBoxesForRow(EDIT_TEAM_LAYOUT, WIDTH, ROW_Y)) {
    fill(screenshot, frame, 230);
    fill(
      screenshot,
      { x: frame.x + FRAME, y: frame.y + FRAME, w: frame.w - 2 * FRAME, h: frame.h - 2 * FRAME },
      70
    );
  }
  const { cards } = boxesForRow(EDIT_TEAM_LAYOUT, WIDTH, ROW_Y);
  cards.forEach((box, i) => paint(screenshot, icons.get(teamIds[i])!, box));

  it("recovers the row and every slot's icon", () => {
    const match = matchScreenshot(screenshot, index);
    assert.ok(match);
    // The frame row is a hypothesis; the icon alignment step absorbs a few px of error.
    assert.ok(Math.abs(match.rowY - ROW_Y) <= 8, `row ${match.rowY}`);
    match.slots.forEach((slot, i) => {
      assert.equal(slot.candidates[0]?.id, teamIds[i], `slot ${i}`);
      assert.ok(slot.candidates[0].score > 0.9, `slot ${i} score ${slot.candidates[0].score}`);
      assert.equal(preselectedCandidate(slot.candidates)?.id, teamIds[i]);
    });
    assert.equal(match.slots[5].assistBox, null);
    assert.ok(match.slots.slice(0, 5).every((s) => s.assistBox));
  });

  it("still recognises cards wearing the attribute orb and awakening badges", () => {
    const badged: RgbaImage = {
      width: WIDTH,
      height: HEIGHT,
      data: Uint8Array.from(screenshot.data),
    };
    for (const box of cards.slice(0, 5)) {
      // Orb over the top-left corner, two large badges over the top-right area.
      fill(badged, { x: box.x, y: box.y, w: Math.round(box.w * 0.22), h: Math.round(box.h * 0.22) }, 250);
      fill(
        badged,
        { x: box.x + Math.round(box.w * 0.4), y: box.y, w: Math.round(box.w * 0.6), h: Math.round(box.h * 0.35) },
        250
      );
    }
    const match = matchScreenshot(badged, index);
    assert.ok(match);
    match.slots.slice(0, 5).forEach((slot, i) => {
      assert.equal(slot.candidates[0]?.id, teamIds[i], `slot ${i}`);
      assert.ok(slot.candidates[0].score > 0.9, `slot ${i} score ${slot.candidates[0].score}`);
    });
  });

  it("aligns a box that starts a few pixels off", () => {
    const box = cards[1];
    const off = { x: box.x + 4, y: box.y - 3, w: box.w + 3, h: box.h + 3 };
    const aligned = alignBoxToCandidates(screenshot, index, off, [{ id: teamIds[1], score: 0 }], 5);
    assert.ok(Math.abs(aligned.x - box.x) <= 1, `x ${aligned.x} vs ${box.x}`);
    assert.ok(Math.abs(aligned.y - box.y) <= 1, `y ${aligned.y} vs ${box.y}`);
    assert.ok(Math.abs(aligned.w - box.w) <= 3, `w ${aligned.w} vs ${box.w}`);
  });

  it("returns null when the image has no room for a card row", () => {
    const tiny: RgbaImage = { width: 40, height: 5, data: new Uint8Array(40 * 5 * 4) };
    assert.equal(matchScreenshot(tiny, index), null);
  });

  it("adds ids confirmed on other slots to a slot's candidate list", () => {
    const desc = cardDescriptor(grayThumbnail(icons.get(1203)!, { x: 0, y: 0, w: ICON, h: ICON }));
    const ranked = [
      { id: 1210, score: 0.6 },
      { id: 1211, score: 0.5 },
    ];
    const merged = withKnownCandidates(index, desc, ranked, [1203, 1210, 999999], TEAM_CARD_CELLS, 3);
    assert.equal(merged[0].id, 1203);
    assert.ok(merged[0].score > 0.99);
    assert.deepEqual(merged.slice(1).map((c) => c.id), [1210, 1211]);
    assert.equal(merged.length, 3);
  });

  it("preselects the best candidate from 75 % and flags it for review below 90 %", () => {
    assert.equal(preselectedCandidate([]), null);
    assert.equal(preselectedCandidate([{ id: 1, score: 0.7 }]), null);
    // A close runner-up (same art on two ids) no longer blocks the preselection.
    assert.equal(
      preselectedCandidate([
        { id: 1, score: 0.8 },
        { id: 2, score: 0.79 },
      ])?.id,
      1
    );
    assert.equal(preselectedCandidate([{ id: 1, score: 0.75 }])?.id, 1);
    assert.equal(needsReview({ id: 1, score: 0.75 }), true);
    assert.equal(needsReview({ id: 1, score: 0.89 }), true);
    assert.equal(needsReview({ id: 1, score: 0.9 }), false);
    assert.deepEqual(
      assistSuggestions([
        { id: 1, score: 0.9 },
        { id: 2, score: 0.5 },
      ]).map((c) => c.id),
      [1]
    );
  });

  it("applies confirmed ids and keeps everything else", () => {
    const members = [
      { ...emptyMember("leader"), monsterId: "10", eqId: "20", level: 110 as const },
      emptyMember("sub"),
      emptyMember("sub"),
      emptyMember("sub"),
      emptyMember("sub"),
      { ...emptyMember("leader"), monsterId: "60" },
    ];
    const next = applyScreenshotSelections(members, [
      { slotIndex: 0, monsterId: 12960 },
      { slotIndex: 1, monsterId: 12932, eqId: 777 },
      { slotIndex: 5, monsterId: null, eqId: null },
    ]);
    assert.equal(next[0].monsterId, "12960");
    assert.equal(next[0].eqId, "20");
    assert.equal(next[0].level, 120, "a different card restarts at the top level");
    assert.equal(next[0].role, "leader");
    const unchanged = applyScreenshotSelections(members, [{ slotIndex: 0, monsterId: 10 }]);
    assert.equal(unchanged[0].level, 110, "same card keeps its level");
    assert.equal(next[1].monsterId, "12932");
    assert.equal(next[1].eqId, "777");
    assert.equal(next[2], members[2]);
    assert.equal(next[5].monsterId, "");
    assert.equal(next[5].eqId, "");
  });
});
