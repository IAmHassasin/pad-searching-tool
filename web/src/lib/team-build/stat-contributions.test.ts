import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MonsterRecord } from "../../types.ts";
import type { DungeonCatalogEntry } from "./dungeon-catalog-types.ts";
import { resolveDungeonModifiers } from "./dungeon-modifiers.ts";
import {
  activeStatAwakeningIds,
  describeSlotContributions,
  inactiveStatAwakeningIds,
} from "./stat-contributions.ts";
import { defaultTeamBuildConfig } from "./types.ts";

const SUN: DungeonCatalogEntry = {
  id: "sun",
  nameJa: "x",
  nameEn: "Sun gravity",
  category: "t",
  sun: true,
  moon: false,
  multiplayer: false,
  maxFloor: 12,
  stat: { hp: 1, atk: 1 / 500, rcv: 1 / 16 },
  superGravity: 1 / 500,
  sourceUrl: "",
};

const shizuru: MonsterRecord = {
  monster_id: 13509, hp_max: 8480, atk_max: 3719, rcv_max: 480, limit_mult: 0, exp: 20_000_000,
  attribute_1_id: 3, type_1_id: 1, sync_awsid: 138,
  awakenings: "(52),(28),(136),(106),(111),(111),(108),(108),(131)",
};
const digiEgg: MonsterRecord = {
  monster_id: 13075, hp_max: 6882, atk_max: 2809, rcv_max: 421, limit_mult: 0, exp: 10_000_000,
  attribute_1_id: 3, type_1_id: 1, type_2_id: 8, awakenings: "(49),(86),(46),(46),(46),(56),(124),(136)",
};

describe("describeSlotContributions", () => {
  it("lists resonance, assist bonus, Levitation and team HP for the PDC leader", () => {
    const base = defaultTeamBuildConfig();
    const cfg = { ...base, dungeonId: "sun", badge: "hp_15" as const };
    const member = { ...cfg.members[0], monsterId: "13509", eqId: "13075", level: 99 as const };
    const dungeon = resolveDungeonModifiers(cfg, [SUN]);
    const list = describeSlotContributions({
      member,
      row: shizuru,
      eq: digiEgg,
      config: cfg,
      dungeon,
      teamAwakenings: [46, 46, 46],
      leaderMult: { hp: 1, rcv: 1 },
    });
    const byId = (id: number, source?: string) =>
      list.find((c) => c.id === id && (!source || c.source === source));
    assert.ok(byId(138, "sync")?.active, "Assist Resonance active via sync");
    assert.ok(byId(106)?.active, "Levitation active under super gravity");
    assert.ok(list.find((c) => c.source === "assist" && c.id === 0)?.active, "assist bonus");
    assert.equal(byId(46, "team")?.copies, 3);
    assert.ok(list.find((c) => c.source === "badge"));
    assert.ok(list.find((c) => c.source === "dungeon"));
    assert.ok(activeStatAwakeningIds(list).has(138));
    assert.ok(!inactiveStatAwakeningIds(list).has(138));
  });

  it("marks Assist Resonance inactive without a matching assist and Self-Reliance with one", () => {
    const base = defaultTeamBuildConfig();
    const dungeon = resolveDungeonModifiers(base, []);
    const card: MonsterRecord = { ...shizuru, sync_awsid: null, awakenings: "(138),(139),(127),(1)" };
    const noEq = describeSlotContributions({
      member: base.members[0],
      row: card,
      eq: null,
      config: base,
      dungeon,
      teamAwakenings: [],
      leaderMult: { hp: 1, rcv: 1 },
    });
    assert.equal(noEq.find((c) => c.id === 138)?.active, false);
    assert.equal(noEq.find((c) => c.id === 139)?.active, true);
    assert.equal(noEq.find((c) => c.id === 127)?.effect, "×1.5 all stats");
    assert.equal(noEq.find((c) => c.id === 1)?.effect, "+3,000 HP");
    assert.ok(inactiveStatAwakeningIds(noEq).has(138));
  });
});
