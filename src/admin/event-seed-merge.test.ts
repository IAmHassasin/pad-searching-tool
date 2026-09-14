import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEventSeed,
  mergeEventSeed,
  resolveMonsterIdByName,
  type EventSeedFile,
} from "./event-seed-merge.ts";

describe("resolveMonsterIdByName", () => {
  const catalog = [
    { monsterId: 100, nameEn: "Izanagi X" },
    { monsterId: 200, nameEn: "Primordial God of the Underworld, Izanagi X" },
    { monsterId: 300, nameEn: "Apocalypse X" },
    { monsterId: 301, nameEn: "Apocalypse X" },
  ];

  it("matches a full name_en", () => {
    assert.equal(
      resolveMonsterIdByName(
        "Primordial God of the Underworld, Izanagi X",
        catalog
      ),
      200
    );
  });

  it("falls back to the substring after the last comma", () => {
    assert.equal(
      resolveMonsterIdByName("Abyssal Dragon of Purple Light, Apocalypse X", catalog),
      301
    );
  });

  it("returns null for unknown names", () => {
    assert.equal(resolveMonsterIdByName("Not A Real Card", catalog), null);
  });
});

describe("mergeEventSeed", () => {
  const existing: EventSeedFile = {
    eventId: "gungho-collab-returns-2609",
    title: "GUNGHO COLLAB RETURNS",
    sourceUrl: "https://example.test/old",
    coverMonsterIds: [1, 2],
    entries: [
      { monsterId: 1, role: "new-monster", label: "Hand written", note: "keep" },
    ],
    loading: { theme: "fade", minMs: 700 },
  };

  it("appends new monster ids and keeps hand-written entries", () => {
    const merged = mergeEventSeed(existing, {
      sourceUrl: "https://example.test/new",
      monsterIds: [1, 9],
    });
    assert.deepEqual(merged.entries, [
      { monsterId: 1, role: "new-monster", label: "Hand written", note: "keep" },
      { monsterId: 9, role: "new-evolution", label: "New Evolution" },
    ]);
    assert.deepEqual(merged.coverMonsterIds, [1, 2, 9]);
    assert.equal(merged.sourceUrl, existing.sourceUrl);
  });
});

describe("createEventSeed", () => {
  it("stamps publishedAt with today's date when omitted", () => {
    const seed = createEventSeed({
      eventId: "pad-x",
      title: "PAD X",
      sourceUrl: "https://example.test/pad-x-event",
      monsterIds: [],
      groupId: 99,
    });
    assert.match(seed.publishedAt ?? "", /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(seed.publishedAt, new Date().toISOString().slice(0, 10));
    assert.equal(seed.groupId, 99);
  });
});
