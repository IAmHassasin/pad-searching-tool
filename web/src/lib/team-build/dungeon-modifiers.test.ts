import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DungeonCatalogEntry } from "./dungeon-catalog-types.ts";
import {
  dungeonCategories,
  filterDungeonEntries,
} from "./dungeon-catalog-types.ts";
import {
  applyDungeonAwakenings,
  applyDungeonStat,
  describeDungeonModifiers,
  resolveDungeonModifiers,
} from "./dungeon-modifiers.ts";
import { defaultTeamBuildConfig } from "./types.ts";

const ENTRIES: DungeonCatalogEntry[] = [
  {
    id: "moon-test",
    nameJa: "月のダンジョン",
    nameEn: "Moon dungeon",
    category: "Sun / Moon",
    sun: false,
    moon: true,
    multiplayer: false,
    maxFloor: 10,
    stat: { hp: 1, atk: 1, rcv: 1 },
    superGravity: null,
    sourceUrl: "https://example.test/moon",
  },
  {
    id: "rcv-down",
    nameJa: "回復減少",
    nameEn: "RCV down dungeon",
    category: "Stat down",
    sun: false,
    moon: false,
    multiplayer: true,
    maxFloor: 3,
    stat: { hp: 1, atk: 0.5, rcv: 0 },
    superGravity: null,
    sourceUrl: "https://example.test/rcv",
  },
];

describe("dungeon modifiers", () => {
  it("is neutral without a dungeon or with an unknown id", () => {
    const cfg = defaultTeamBuildConfig();
    const none = resolveDungeonModifiers(cfg, ENTRIES);
    assert.deepEqual(none.stat, { hp: 1, atk: 1, rcv: 1 });
    assert.equal(none.awkSettings, cfg.awkSettings);
    assert.deepEqual(none.dungeonAwks, []);

    const unknown = resolveDungeonModifiers(
      { ...cfg, dungeonId: "does-not-exist" },
      ENTRIES
    );
    assert.deepEqual(unknown.stat, { hp: 1, atk: 1, rcv: 1 });
    assert.equal(unknown.entry, null);
  });

  it("turns on the awakenings the dungeon activates", () => {
    const cfg = { ...defaultTeamBuildConfig(), dungeonId: "moon-test" };
    const r = resolveDungeonModifiers(cfg, ENTRIES);
    assert.deepEqual(r.dungeonAwks, [129, 130]);
    assert.ok(r.awkSettings.enabled.includes(129));
    assert.ok(!r.awkSettings.enabled.includes(128));
    assert.equal(r.awkSettings.yinYang, 129);
    assert.equal(r.awkSettings.agingBattle, 10);
    assert.equal(r.label, "Moon dungeon");
  });

  it("keeps the user's manual awakenings and adds multiplayer / stat downs", () => {
    const base = defaultTeamBuildConfig();
    const cfg = {
      ...base,
      dungeonId: "rcv-down",
      awkSettings: { ...base.awkSettings, enabled: [27] },
    };
    const r = resolveDungeonModifiers(cfg, ENTRIES);
    assert.deepEqual([...r.awkSettings.enabled].sort((a, b) => a - b), [27, 30]);
    assert.deepEqual(r.stat, { hp: 1, atk: 0.5, rcv: 0 });
    assert.equal(applyDungeonStat(1000, r.stat, "atk"), 500);
    assert.equal(applyDungeonStat(1000, r.stat, "rcv"), 0);
    assert.equal(applyDungeonStat(1000, r.stat, "hp"), 1000);
  });

  it("uses the custom editor values", () => {
    const cfg = {
      ...defaultTeamBuildConfig(),
      dungeonId: "custom",
      customDungeon: { hp: 2, atk: 1, rcv: 0.5, sun: true, moon: false },
    };
    const r = resolveDungeonModifiers(cfg, ENTRIES);
    assert.deepEqual(r.stat, { hp: 2, atk: 1, rcv: 0.5 });
    assert.deepEqual(r.dungeonAwks, [128]);
    assert.equal(r.awkSettings.yinYang, 128);
  });

  it("prefers moon when both flags are set and sets aging thresholds", () => {
    const base = defaultTeamBuildConfig().awkSettings;
    const both = applyDungeonAwakenings(base, {
      sun: true,
      moon: true,
      multiplayer: false,
      maxFloor: 7,
    });
    assert.deepEqual(both.enabled, [129, 130]);
    assert.equal(both.settings.agingBattle, 5);
    const low = applyDungeonAwakenings(base, {
      sun: false,
      moon: false,
      multiplayer: false,
      maxFloor: 4,
    });
    assert.deepEqual(low.enabled, []);
  });

  it("describes modifiers and filters the catalog", () => {
    assert.deepEqual(
      describeDungeonModifiers({ hp: 1, atk: 0.5, rcv: 0 }, ENTRIES[1]),
      ["Multiplayer", "ATK ×0.5", "RCV ×0"]
    );
    assert.deepEqual(
      describeDungeonModifiers(
        { hp: 1, atk: 1 / 2500, rcv: 0.5 },
        { conditional: [{ types: [3], hp: 1.5, atk: 1, rcv: 1 }] }
      ),
      ["ATK ×1/2500", "RCV ×0.5", "Healer HP ×1.5"]
    );
    assert.deepEqual(dungeonCategories(ENTRIES), ["Sun / Moon", "Stat down"]);
    assert.equal(filterDungeonEntries(ENTRIES, "moon").length, 1);
    assert.equal(filterDungeonEntries(ENTRIES, "回復").length, 1);
    assert.equal(filterDungeonEntries(ENTRIES, "").length, 2);
  });
});
