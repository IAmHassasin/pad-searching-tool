import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CARD_DESCRIPTOR_LENGTH, TEAM_CARD_CELLS } from "./descriptor.ts";
import {
  encodeIconIndex,
  indexDescriptor,
  parseIconIndex,
  rankIconCandidates,
} from "./icon-index.ts";

function pattern(seed: number): Uint8Array {
  const out = new Uint8Array(CARD_DESCRIPTOR_LENGTH);
  let s = seed;
  for (let i = 0; i < out.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = s % 256;
  }
  return out;
}

describe("icon index", () => {
  it("round-trips entries sorted by id", () => {
    const bytes = encodeIconIndex([
      { id: 300, descriptor: pattern(3) },
      { id: 100, descriptor: pattern(1) },
      { id: 200, descriptor: pattern(2) },
    ]);
    const index = parseIconIndex(bytes);
    assert.equal(index.count, 3);
    assert.equal(index.length, CARD_DESCRIPTOR_LENGTH);
    assert.deepEqual([...index.ids], [100, 200, 300]);
    assert.deepEqual([...indexDescriptor(index, 1)], [...pattern(2)]);
  });

  it("ranks the exact descriptor first with score ~1", () => {
    const entries = Array.from({ length: 50 }, (_, i) => ({
      id: 1000 + i,
      descriptor: pattern(i + 1),
    }));
    const index = parseIconIndex(encodeIconIndex(entries));
    const ranked = rankIconCandidates(index, pattern(21), 3);
    assert.equal(ranked.length, 3);
    assert.equal(ranked[0].id, 1020);
    assert.ok(ranked[0].score > 0.999);
    assert.ok(ranked[1].score < ranked[0].score);
  });

  it("ignores constant descriptors and empty queries", () => {
    const index = parseIconIndex(
      encodeIconIndex([{ id: 5, descriptor: new Uint8Array(CARD_DESCRIPTOR_LENGTH) }])
    );
    assert.deepEqual(rankIconCandidates(index, pattern(1)), []);
    assert.deepEqual(
      rankIconCandidates(index, new Uint8Array(CARD_DESCRIPTOR_LENGTH)),
      []
    );
  });

  it("rejects foreign or truncated files", () => {
    assert.throws(() => parseIconIndex(new Uint8Array([1, 2, 3])), /truncated/);
    const bytes = encodeIconIndex([{ id: 1, descriptor: pattern(1) }]);
    bytes[0] = 0x58;
    assert.throws(() => parseIconIndex(bytes), /Not an icon index/);
    const good = encodeIconIndex([{ id: 1, descriptor: pattern(1) }]);
    assert.throws(() => parseIconIndex(good.subarray(0, good.length - 10)), /truncated/);
  });

  it("ranks over a cell mask only", () => {
    const entries = Array.from({ length: 50 }, (_, i) => ({
      id: 1000 + i,
      descriptor: pattern(i + 1),
    }));
    const index = parseIconIndex(encodeIconIndex(entries));
    // Query = icon 1020 with everything outside the team-card cells overwritten.
    const query = Uint8Array.from(pattern(21));
    const keep = new Set(TEAM_CARD_CELLS);
    for (let i = 0; i < query.length; i++) if (!keep.has(i)) query[i] = 255;
    const masked = rankIconCandidates(index, query, 3, TEAM_CARD_CELLS);
    assert.equal(masked[0].id, 1020);
    assert.ok(masked[0].score > 0.999);
    const unmasked = rankIconCandidates(index, query, 1);
    assert.ok(unmasked[0].id !== 1020 || unmasked[0].score < 0.95);
    // A mask pointing past the descriptor yields nothing instead of garbage.
    assert.deepEqual(
      rankIconCandidates(index, query, 3, new Uint16Array([0, CARD_DESCRIPTOR_LENGTH])),
      []
    );
  });
});
