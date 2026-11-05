import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DungeonSummary } from "../../dungeon-details/types.ts";
import type { DungeonCatalogEntry } from "./dungeon-catalog-types.ts";
import {
  APPMEDIA_ONLY_CATEGORY,
  maxHitForEntry,
  mergeDungeonSources,
  seedForEntry,
  shortDungeonTitle,
} from "./dungeon-sources.ts";

const seed = (appmediaPostId: number, titleEn: string): DungeonSummary => ({
  appmediaPostId,
  titleJa: "【パズドラ】鳳凰チャレンジの攻略や対策とおすすめパーティ｜轟爆の鳳凰帝",
  titleEn,
  sourceUrl: `https://appmedia.jp/pazudora/${appmediaPostId}`,
  modified: null,
  importedAt: "2026-11-05",
  maxDamage: { value: 21_930_000, floor: "B15", monsterId: 1, monsterNameJa: "G", raw: "x" },
});

const entry = (id: string, appmediaPostId?: number): DungeonCatalogEntry => ({
  id,
  nameJa: id,
  nameEn: id,
  category: "Test",
  sun: false,
  moon: false,
  multiplayer: false,
  maxFloor: 15,
  stat: { hp: 1, atk: 0.001, rcv: 1 },
  superGravity: 0.001,
  sourceUrl: "https://example.test",
  appmediaPostId,
});

describe("shortDungeonTitle", () => {
  it("keeps the dungeon name and the suffix after the pipe", () => {
    assert.equal(
      shortDungeonTitle({ titleEn: "Phoenix Challenge — counters & recommended teams | Roaring Phoenix Emperor", titleJa: "" }),
      "Phoenix Challenge · Roaring Phoenix Emperor"
    );
    assert.equal(
      shortDungeonTitle({ titleEn: "Silver Wing Challenge — counters & recommended teams (1.2B dungeon)", titleJa: "" }),
      "Silver Wing Challenge"
    );
  });

  it("falls back to the stripped JP title", () => {
    assert.equal(
      shortDungeonTitle({ titleEn: null, titleJa: "【パズドラ】鳳凰チャレンジ｜轟爆の鳳凰帝" }),
      "鳳凰チャレンジ · 轟爆の鳳凰帝"
    );
  });
});

describe("mergeDungeonSources", () => {
  it("keeps linked seeds on their catalog entry and appends the rest", () => {
    const catalog = [entry("phoenix", 80439652), entry("other")];
    const merged = mergeDungeonSources(catalog, [seed(80439652, "Phoenix"), seed(1, "New one | Realm")]);
    assert.deepEqual(
      merged.map((e) => [e.id, e.category, e.appmediaPostId ?? null]),
      [
        ["phoenix", "Test", 80439652],
        ["other", "Test", null],
        ["appmedia-1", APPMEDIA_ONLY_CATEGORY, 1],
      ]
    );
    assert.deepEqual(merged[2].stat, { hp: 1, atk: 1, rcv: 1 });
    assert.equal(merged[2].nameEn, "New one · Realm");
  });

  it("returns the catalog itself when every seed is linked", () => {
    const catalog = [entry("phoenix", 80439652)];
    assert.equal(mergeDungeonSources(catalog, [seed(80439652, "Phoenix")]), catalog);
  });
});

describe("maxHitForEntry", () => {
  const map = new Map([[80439652, seed(80439652, "Phoenix")]]);
  it("prefers the floor table and falls back to the scraped value", () => {
    assert.equal(maxHitForEntry(entry("phoenix", 80439652), map)?.source, "floor-table");
    const scraped = {
      ...entry("jupiter"),
      maxHit: { value: 10_200_000, raw: "・10,200,000ダメージ", sourceUrl: "https://kamigame.jp/x", source: "kamigame" as const, floor: "12F" },
    };
    assert.deepEqual(maxHitForEntry(scraped, map), {
      value: 10_200_000,
      floor: "12F",
      monsterId: null,
      monsterNameJa: null,
      raw: "・10,200,000ダメージ",
      source: "kamigame",
      sourceUrl: "https://kamigame.jp/x",
    });
    assert.equal(maxHitForEntry(entry("none"), map), null);
    assert.equal(maxHitForEntry({ ...entry("zero"), maxHit: { value: 0, raw: "", sourceUrl: "", source: "appmedia" } }, map), null);
  });
});

describe("seedForEntry", () => {
  const map = new Map([[80439652, seed(80439652, "Phoenix")]]);
  it("resolves through appmediaPostId", () => {
    assert.equal(seedForEntry(entry("phoenix", 80439652), map)?.maxDamage?.value, 21_930_000);
    assert.equal(seedForEntry(entry("other"), map), null);
    assert.equal(seedForEntry(entry("missing", 5), map), null);
    assert.equal(seedForEntry(null, map), null);
  });
});
