import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { syncNewEvents } from "./event-catalog-sync.ts";
import type { EventSeedFile } from "./event-seed-merge.ts";

const NEWS = `
<a href="https://www.puzzleanddragons.us/single-post/pad-x-event-2609">PAD X Event</a>
<a href="https://www.puzzleanddragons.us/single-post/pad-x-super-godfest-2609">Godfest</a>
<a href="https://www.puzzleanddragons.us/single-post/new-evolutions-upgrades-2609-2">evo</a>
`;

const PAD_X_ARTICLE = `
<p>Primordial God of the Underworld, Izanagi X and Abyssal Dragon of Purple Light, Apocalypse X have received Assist Evolutions! Select PAD X monsters have received upgrades as well!</p>
`;

const CATALOG = [
  { monsterId: 200, nameEn: "Primordial God of the Underworld, Izanagi X" },
  { monsterId: 301, nameEn: "Apocalypse X" },
];

describe("syncNewEvents", () => {
  it("creates cards from Assist Evolution names and does not rewrite existing events", async () => {
    const gungho: EventSeedFile = {
      eventId: "gungho-collab-returns-2609",
      title: "GUNGHO COLLAB RETURNS",
      entries: [{ monsterId: 1, role: "new-monster" }],
      coverMonsterIds: [1],
    };
    const seeds = new Map<string, EventSeedFile>([[gungho.eventId, gungho]]);

    const result = await syncNewEvents({
      fetchNewsHtml: async () => NEWS,
      fetchArticleHtml: async () => PAD_X_ARTICLE,
      listEvents: () =>
        [...seeds.values()].map((s) => ({
          eventId: s.eventId,
          title: s.title,
        })),
      loadSeed: (id) => seeds.get(id) ?? null,
      saveSeed: (seed) => {
        seeds.set(seed.eventId, seed);
      },
      catalog: CATALOG,
      groups: [{ groupId: 99, groupName: "PAD X" }],
    });

    assert.deepEqual(result.created, ["pad-x"]);
    assert.deepEqual(result.skippedExisting, []);
    const created = seeds.get("pad-x");
    assert.equal(
      created?.sourceUrl,
      "https://www.puzzleanddragons.us/single-post/pad-x-event-2609"
    );
    assert.equal(created?.groupId, 99);
    assert.deepEqual(
      created?.entries.map((e) => e.monsterId),
      [200, 301]
    );
    assert.deepEqual(created?.coverMonsterIds, [200, 301]);
    assert.match(created?.publishedAt ?? "", /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(seeds.get("gungho-collab-returns-2609")?.entries, [
      { monsterId: 1, role: "new-monster" },
    ]);
  });

  it("fills an empty stub instead of skipping it", async () => {
    const seeds = new Map<string, EventSeedFile>([
      [
        "pad-x",
        {
          eventId: "pad-x",
          title: "PAD X",
          sourceUrl: "https://www.puzzleanddragons.us/single-post/pad-x-event-2609",
          entries: [],
          coverMonsterIds: [],
        },
      ],
    ]);
    const result = await syncNewEvents({
      fetchNewsHtml: async () => NEWS,
      fetchArticleHtml: async () => PAD_X_ARTICLE,
      listEvents: () =>
        [...seeds.values()].map((s) => ({
          eventId: s.eventId,
          title: s.title,
        })),
      loadSeed: (id) => seeds.get(id) ?? null,
      saveSeed: (seed) => {
        seeds.set(seed.eventId, seed);
      },
      catalog: CATALOG,
      groups: [{ groupId: 99, groupName: "PAD X" }],
    });
    assert.deepEqual(result.created, ["pad-x"]);
    assert.deepEqual(result.skippedExisting, []);
    assert.equal(seeds.get("pad-x")?.groupId, 99);
    assert.deepEqual(
      seeds.get("pad-x")?.entries.map((e) => e.monsterId),
      [200, 301]
    );
  });

  it("skips an event name that already has cards", async () => {
    const seeds = new Map<string, EventSeedFile>([
      [
        "gungho-collab-returns-2609",
        {
          eventId: "gungho-collab-returns-2609",
          title: "GUNGHO COLLAB RETURNS",
          entries: [{ monsterId: 1, role: "new-monster" }],
        },
      ],
    ]);
    const result = await syncNewEvents({
      fetchNewsHtml: async () =>
        `<a href="https://www.puzzleanddragons.us/single-post/new-evolutions-upgrades-2608">evo</a>`,
      fetchArticleHtml: async () =>
        "Select GungHo Collab characters have received upgrades as well!",
      listEvents: () =>
        [...seeds.values()].map((s) => ({
          eventId: s.eventId,
          title: s.title,
        })),
      loadSeed: (id) => seeds.get(id) ?? null,
      saveSeed: (seed) => {
        seeds.set(seed.eventId, seed);
      },
      catalog: CATALOG,
    });
    assert.deepEqual(result.created, []);
    assert.deepEqual(result.skippedExisting, ["gungho-collab-returns-2609"]);
  });

  it("counts articles that lack the Select-upgrades sentence", async () => {
    const result = await syncNewEvents({
      fetchNewsHtml: async () => NEWS,
      fetchArticleHtml: async () => "<p>PAD X Super Godfest arrives</p>",
      listEvents: () => [],
      loadSeed: () => null,
      saveSeed: () => {},
    });
    assert.equal(result.unparsedArticles, 1);
    assert.deepEqual(result.created, []);
  });
});
