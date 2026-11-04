import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MonsterRecord } from "../../types.ts";
import { computeTeamStats } from "./compute-stats.ts";
import { resolveDungeonModifiers } from "./dungeon-modifiers.ts";
import { defaultTeamBuildConfig, type TeamBuildConfig } from "./types.ts";

/** Lv.99 card without limit break so level scaling is a no-op. */
function monster(id: number, extra: Partial<MonsterRecord> = {}): MonsterRecord {
  return {
    monster_id: id,
    name_en: `Card ${id}`,
    hp_max: 1000,
    atk_max: 500,
    rcv_max: 200,
    limit_mult: 0,
    exp: 4_000_000,
    attribute_1_id: 0,
    type_1_id: 5,
    awakenings: "",
    leader_skill_desc_en: "",
    ...extra,
  };
}

function configWith(partial: Partial<TeamBuildConfig>): TeamBuildConfig {
  const base = defaultTeamBuildConfig();
  return {
    ...base,
    ...partial,
    members: base.members.map((m, i) =>
      i === 0
        ? { ...m, monsterId: "1", level: 99, plusHp: 0, plusAtk: 0, plusRcv: 0 }
        : m
    ),
  };
}

const ENTRIES = [
  {
    id: "half-rcv",
    nameJa: "x",
    nameEn: "Half RCV",
    category: "Stat down",
    sun: false,
    moon: true,
    multiplayer: false,
    maxFloor: null,
    stat: { hp: 1, atk: 2, rcv: 0.5 },
    superGravity: null,
    sourceUrl: "",
  },
  {
    id: "healer-boost",
    nameJa: "y",
    nameEn: "Healer boost",
    category: "Stat down",
    sun: false,
    moon: false,
    multiplayer: false,
    maxFloor: null,
    stat: { hp: 1, atk: 1, rcv: 1 },
    superGravity: null,
    conditional: [{ types: [3], hp: 1.5, atk: 1, rcv: 1 }],
    sourceUrl: "",
  },
];

describe("computeTeamStats with dungeon", () => {
  it("leaves totals unchanged without a dungeon", () => {
    const cfg = configWith({});
    const map = new Map([[1, monster(1)]]);
    const s = computeTeamStats(cfg, map);
    assert.equal(s.members[0].hp.afterRaw, 1000);
    assert.equal(s.members[0].hp.afterDungeon, 1000);
    assert.equal(s.teamHp, 1000);
    assert.equal(s.teamAtk, 500);
    assert.equal(s.teamRcv, 200);
  });

  it("applies the dungeon stat multipliers after badge and leader skill", () => {
    const cfg = configWith({ dungeonId: "half-rcv", badge: "hp_10" });
    const map = new Map([[1, monster(1)]]);
    const s = computeTeamStats(cfg, map, resolveDungeonModifiers(cfg, ENTRIES));
    const m = s.members[0];
    assert.equal(m.hp.afterDungeon, 1000);
    assert.equal(m.hp.afterBadge, 1100);
    assert.equal(m.atk.afterDungeon, 1000);
    assert.equal(m.rcv.afterDungeon, 100);
    assert.equal(s.teamHp, 1100);
    assert.equal(s.teamAtk, 1000);
    assert.equal(s.teamRcv, 100);
    // Raw slot stats ignore badge / dungeon.
    assert.equal(s.teamRawHp, 1000);
  });

  it("activates the dungeon's awakenings on cards that have them", () => {
    const cfg = configWith({ dungeonId: "half-rcv" });
    // Yin Protection (129): HP ×2, RCV ×2, ATK ×5 in Moon dungeons.
    const map = new Map([[1, monster(1, { awakenings: "(129),(27)" })]]);
    const s = computeTeamStats(cfg, map, resolveDungeonModifiers(cfg, ENTRIES));
    const m = s.members[0];
    assert.equal(m.hp.afterAwk, 2000);
    assert.equal(m.hp.afterDungeon, 2000);
    assert.equal(m.atk.afterDungeon, 500 * 5 * 2);
    assert.equal(m.rcv.afterDungeon, 200);
    // The raw slot value never includes dungeon awakenings.
    assert.equal(m.hp.afterRaw, 1000);
  });

  it("adds flat awakenings to raw stats and team awakenings to totals", () => {
    const cfg = configWith({});
    // Two Enhanced HP (+3000 each), one Enhanced Team HP (+5%), one Enhanced Team RCV (+20%).
    const map = new Map([[1, monster(1, { awakenings: "(1),(1),(46),(47)" })]]);
    const s = computeTeamStats(cfg, map);
    const m = s.members[0];
    assert.equal(m.hp.afterFlatAwk, 7000);
    assert.equal(m.hp.afterRaw, 7000);
    assert.equal(m.hp.afterBadge, 7350);
    assert.equal(m.rcv.afterBadge, 240);
    assert.equal(s.teamHp, 7350);
  });

  it("applies ATK badges and type badges", () => {
    const god = new Map([[1, monster(1, { type_1_id: 5 })]]);
    const atk15 = computeTeamStats(configWith({ badge: "atk_15" }), god);
    assert.equal(atk15.teamAtk, 575);
    const typeGod = computeTeamStats(configWith({ badge: "type_god" }), god);
    assert.equal(typeGod.teamAtk, 2500);
    assert.equal(typeGod.teamHp, 1050);
    const typeDevil = computeTeamStats(configWith({ badge: "type_devil" }), god);
    assert.equal(typeDevil.teamAtk, 500);
  });

  it("counts passive stat awakenings and Assist Resonance / Self-Reliance", () => {
    // Enhanced Stat (127) ×1.5 always.
    const plain = new Map([[1, monster(1, { awakenings: "(127)" })]]);
    assert.equal(computeTeamStats(configWith({}), plain).members[0].hp.afterRaw, 1500);

    // Self-Reliance (139) ×3 only without an assist.
    const self = new Map([[1, monster(1, { awakenings: "(139)" })]]);
    assert.equal(computeTeamStats(configWith({}), self).members[0].hp.afterRaw, 3000);
    const withEq = configWith({});
    withEq.members[0] = { ...withEq.members[0], eqId: "2" };
    const selfEq = new Map([
      [1, monster(1, { awakenings: "(139)" })],
      [2, monster(2, { attribute_1_id: 1, limit_mult: 0 })],
    ]);
    assert.equal(computeTeamStats(withEq, selfEq).members[0].hp.afterRaw, 1000);

    // Assist Resonance (138) ×3 only when main attribute and a type match.
    const resonance = new Map([
      [1, monster(1, { awakenings: "(138)", attribute_1_id: 0, type_1_id: 5 })],
      [2, monster(2, { attribute_1_id: 0, type_1_id: 4, type_2_id: 5 })],
    ]);
    const r = computeTeamStats(withEq, resonance).members[0];
    // +10% of the assist's HP incl. its default +297 (same attribute), then ×3.
    assert.equal(r.hp.afterRaw, (1000 + 199) * 3);
    const noMatch = new Map([
      [1, monster(1, { awakenings: "(138)", attribute_1_id: 0, type_1_id: 5 })],
      [2, monster(2, { attribute_1_id: 0, type_1_id: 4 })],
    ]);
    assert.equal(computeTeamStats(withEq, noMatch).members[0].hp.afterRaw, 1199);

    // Enabling the same id in the manual awk settings must not double it.
    const base = configWith({});
    const dup = { ...base, awkSettings: { ...base.awkSettings, enabled: [127] } };
    assert.equal(computeTeamStats(dup, plain).teamHp, 1500);
  });

  it("stacks dungeon awakenings per copy and restores ATK with Levitation", () => {
    const sun = [
      {
        id: "sun-gravity",
        nameJa: "x",
        nameEn: "Sun gravity",
        category: "t",
        sun: true,
        moon: false,
        multiplayer: false,
        maxFloor: null,
        stat: { hp: 1, atk: 1 / 500, rcv: 1 / 16 },
        superGravity: 1 / 500,
        sourceUrl: "",
      },
    ];
    const cfg = configWith({ dungeonId: "sun-gravity" });
    // Yang Protection twice (two regular copies) and Levitation.
    const map = new Map([[1, monster(1, { awakenings: "(128),(128),(106)" })]]);
    const s = computeTeamStats(cfg, map, resolveDungeonModifiers(cfg, sun));
    const m = s.members[0];
    assert.equal(m.hp.afterDungeon, 1000 * 4);
    assert.equal(m.atk.afterDungeon, Math.round((500 * 25) / 500 * 20));
    assert.equal(m.rcv.afterDungeon, Math.round((200 * 4) / 16));
  });

  it("scales the assist at its own max level, not the base card's level", () => {
    const base = defaultTeamBuildConfig();
    const cfg = {
      ...base,
      members: base.members.map((m, i) =>
        i === 0
          ? { ...m, monsterId: "1", eqId: "2", level: 99 as const, plusHp: 0, plusAtk: 0, plusRcv: 0, eqPlusHp: 0, eqPlusRcv: 0, eqPlusAtk: 0 }
          : m
      ),
    };
    // Assist can reach Lv120 (lm 10, 1B exp): HP 1000 × 1.2 = 1200 → 10% = 120.
    const map = new Map([
      [1, monster(1)],
      [2, monster(2, { limit_mult: 10, exp: 1_000_000_000 })],
    ]);
    assert.equal(computeTeamStats(cfg, map).members[0].hp.afterRaw, 1120);
  });

  it("applies type-limited boosts only to matching members", () => {
    const cfg = configWith({ dungeonId: "healer-boost" });
    const healer = new Map([[1, monster(1, { type_1_id: 3 })]]);
    const god = new Map([[1, monster(1, { type_1_id: 5 })]]);
    const d = resolveDungeonModifiers(cfg, ENTRIES);
    assert.equal(computeTeamStats(cfg, healer, d).teamHp, 1500);
    assert.equal(computeTeamStats(cfg, god, d).teamHp, 1000);
  });
});
