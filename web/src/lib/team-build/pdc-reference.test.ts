import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MonsterRecord } from "../../types.ts";
import { computeTeamStats } from "./compute-stats.ts";
import type { DungeonCatalogEntry } from "./dungeon-catalog-types.ts";
import { resolveDungeonModifiers } from "./dungeon-modifiers.ts";
import { defaultTeamBuildConfig, type TeamMemberConfig } from "./types.ts";

/**
 * Regression against the PDC (パズドラダメージ計算) team screen captured on
 * 2026-11-04: 天空の儚域／風雲の龍王 (sun, ATK 1/500, RCV 1/16), every card
 * +297, assists +297. Rows mirror seed/dadguide.sqlite.
 */
const DB: Record<number, MonsterRecord> = {
  13509: {
    monster_id: 13509, name_en: "Wonderful Key Hero, Shizuru", hp_max: 8480, atk_max: 3719, rcv_max: 480,
    limit_mult: 0, exp: 20_000_000, cost: 55, attribute_1_id: 3, attribute_2_id: 4, type_1_id: 1,
    sync_awsid: 138, awakenings: "(52),(28),(136),(106),(111),(111),(108),(108),(131)",
    leader_skill_desc_en: "Reduce damage taken by 82% when matching Light and Dark; 2x RCV when matching Light and Dark at once",
  },
  13514: {
    monster_id: 13514, name_en: "Dim Gleam Key Hero, Bergal", hp_max: 5977, atk_max: 3409, rcv_max: 10,
    limit_mult: 30, exp: 20_000_000, cost: 45, attribute_1_id: 4, attribute_2_id: 3, type_1_id: 6,
    awakenings: "(52),(56),(56),(28),(53),(111),(111),(108),(108)", super_awakenings: "(56),(108),(131),(138)",
  },
  12905: {
    monster_id: 12905, name_en: "Mina Ashiro & Soshiro Hoshina", hp_max: 6289, atk_max: 3784, rcv_max: 12,
    limit_mult: 30, exp: 4_000_000, cost: 40, attribute_1_id: 0, attribute_2_id: 4, type_1_id: 6, type_2_id: 8,
    awakenings: "(52),(56),(56),(28),(110),(110),(111),(111),(63)", super_awakenings: "(56),(59),(131),(138)",
  },
  13483: {
    monster_id: 13483, name_en: "Life of the Draconic Transcendence, Zelclea", hp_max: 8562, atk_max: 2833, rcv_max: 2039,
    limit_mult: 10, exp: 1_000_000_000, cost: 50, attribute_1_id: 3, attribute_2_id: 3, type_1_id: 4, type_2_id: 3,
    sync_awsid: 128, awakenings: "(52),(104),(104),(104),(106),(111),(111),(128),(63)",
    leader_skill_desc_en: "25x ATK and reduce damage taken by 50% when matching 2+ Heal combos; 2.8x all stats for Healer type",
  },
  13422: {
    monster_id: 13422, name_en: "Imperial Mage, Denken", hp_max: 9252, atk_max: 5209, rcv_max: 265,
    limit_mult: 0, exp: 4_000_000, cost: 45, attribute_1_id: 3, attribute_2_id: 4, type_1_id: 6,
    sync_awsid: 142, awakenings: "(52),(124),(68),(69),(137),(106),(111),(111),(63)",
  },
  // Assists
  13075: { monster_id: 13075, hp_max: 6882, atk_max: 2809, rcv_max: 421, limit_mult: 0, exp: 10_000_000, cost: 100, attribute_1_id: 3, type_1_id: 1, type_2_id: 8, awakenings: "(49),(86),(46),(46),(46),(56),(124),(136)" },
  13221: { monster_id: 13221, hp_max: 6914, atk_max: 4604, rcv_max: 414, limit_mult: 0, exp: 10_000_000, cost: 80, attribute_1_id: 4, attribute_2_id: 0, type_1_id: 6, awakenings: "(49),(21),(21),(29),(29),(46),(46),(136)" },
  8755: { monster_id: 8755, hp_max: 3008, atk_max: 1518, rcv_max: 302, limit_mult: 0, exp: 10_000_000, cost: 60, attribute_1_id: 0, type_1_id: 6, type_2_id: 8, awakenings: "(49),(53),(55),(56),(79),(99),(46),(46)" },
  60725: { monster_id: 60725, hp_max: 8559, atk_max: 5224, rcv_max: 0, limit_mult: 0, exp: 10_000_000, cost: 70, attribute_1_id: 0, type_1_id: 7, awakenings: "(49),(21),(28),(46),(46),(31),(36)" },
  13496: { monster_id: 13496, hp_max: 10769, atk_max: 4992, rcv_max: 76, limit_mult: 0, exp: 10_000_000, cost: 90, attribute_1_id: 1, attribute_2_id: 2, type_1_id: 4, type_2_id: 2, awakenings: "(49),(52),(56),(46),(46),(46),(100),(101)" },
};

const WIND_CLOUD: DungeonCatalogEntry = {
  id: "wind-cloud",
  nameJa: "天空の儚域／風雲の龍王【超重力】",
  nameEn: "Ephemeral Sky Realm: Dragon King of Wind and Cloud",
  category: "Ephemeral Sky Realm (天空の儚域)",
  sun: true,
  moon: false,
  multiplayer: false,
  maxFloor: 12,
  stat: { hp: 1, atk: 1 / 500, rcv: 1 / 16 },
  superGravity: 1 / 500,
  sourceUrl: "https://appmedia.jp/?p=79768151",
};

function member(
  base: TeamMemberConfig,
  monsterId: number,
  eqId: number,
  level: 99 | 110 | 120,
  sa: number | null = null
): TeamMemberConfig {
  return {
    ...base,
    monsterId: String(monsterId),
    eqId: String(eqId),
    level,
    plusHp: 99,
    plusAtk: 99,
    plusRcv: 99,
    eqPlusHp: 99,
    eqPlusRcv: 99,
    eqPlusAtk: 99,
    selectedSuperAwakening: sa,
  };
}

function within(actual: number, expected: number, tolerance: number, label: string) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ±${tolerance}, got ${actual}`
  );
}

describe("in-game reference: 7943 Kunimitsu Tezuka Lv99 +297 (Skill Voice)", () => {
  it("matches HP 6035 / ATK 3512 / RCV 936", () => {
    const base = defaultTeamBuildConfig();
    const cfg = {
      ...base,
      members: base.members.map((m, i) =>
        i === 0
          ? { ...m, monsterId: "7943", eqId: "", level: 99 as const, plusHp: 99, plusAtk: 99, plusRcv: 99 }
          : m
      ),
    };
    const row: MonsterRecord = {
      monster_id: 7943, hp_max: 4586, atk_max: 2743, rcv_max: 581, limit_mult: 0, exp: 4_000_000, cost: 40,
      attribute_1_id: 0, type_1_id: 6, awakenings: "(52),(56),(28),(53),(61),(61),(61),(108),(63)",
    };
    const s = computeTeamStats(cfg, new Map([[7943, row]]));
    assert.equal(s.members[0].hp.afterRaw, 6035);
    assert.equal(s.members[0].atk.afterRaw, 3512);
    assert.equal(s.members[0].rcv.afterRaw, 936);
  });
});

describe("PDC reference team (風雲の龍王)", () => {
  const base = defaultTeamBuildConfig();
  const cfg = {
    ...base,
    dungeonId: "wind-cloud",
    members: [
      member(base.members[0], 13509, 13075, 99),
      member(base.members[1], 13514, 13221, 120, 138),
      member(base.members[2], 12905, 8755, 120, 138),
      member(base.members[3], 13483, 60725, 120),
      member(base.members[4], 13422, 13496, 99),
      member(base.members[5], 13509, 13075, 99),
    ],
  };
  const map = new Map(Object.values(DB).map((r) => [r.monster_id!, r]));
  const summary = computeTeamStats(cfg, map, resolveDungeonModifiers(cfg, [WIND_CLOUD]));
  const at = (i: number) => summary.members[i];
  // Per-slot ステ values exclude the badge and team awakenings; the team awakenings only
  // enter via afterBadge, so compare the per-card raw × dungeon values here.

  it("Shizuru: Assist Resonance (sync) ×3 on stat + assist bonus, Levitation under super gravity", () => {
    within(at(0).hp.afterDungeon, 30_771, 2, "HP");
    within(at(0).atk.afterDungeon, 525, 2, "ATK");
    within(at(0).rcv.afterDungeon, 166, 2, "RCV");
  });

  it("Bergal: Lv120 (+30% LB, additive SLB), super awakening Assist Resonance, no Levitation", () => {
    within(at(1).hp.afterDungeon, 30_444, 2, "HP");
    within(at(1).atk.afterDungeon, 32, 1, "ATK");
    within(at(1).rcv.afterDungeon, 78, 1, "RCV");
  });

  it("Mina & Soshiro: Skill Voice ×1.1, +30% LB, super awakening Assist Resonance", () => {
    within(at(2).hp.afterDungeon, 33_228, 6, "HP");
    within(at(2).atk.afterDungeon, 37, 1, "ATK");
    within(at(2).rcv.afterDungeon, 76, 1, "RCV");
  });

  it("Zelclea: Skill Voice, 1B-exp LB = lm, additive SLB; two Yang Protections stack to HP ×4 / ATK ×25 / RCV ×4", () => {
    within(at(3).hp.afterDungeon, 49_164, 6, "HP");
    within(at(3).atk.afterDungeon, 4_079, 20, "ATK");
    within(at(3).rcv.afterDungeon, 719, 3, "RCV");
  });

  it("Denken: Skill Voice ×1.1 on the base, Enhanced Stats+ ×1.8 (sync)", () => {
    within(at(4).hp.afterDungeon, 20_101, 2, "HP");
    within(at(4).atk.afterDungeon, 448, 2, "ATK");
    within(at(4).rcv.afterDungeon, 66, 1, "RCV");
  });

  it("PT情報 totals: 15 Enhanced Team HP from assists (+75 %) × HP +15 % badge = 391,390; RCV 1,271", () => {
    const withBadge = { ...cfg, badge: "hp_15" as const };
    const s = computeTeamStats(withBadge, map, resolveDungeonModifiers(withBadge, [WIND_CLOUD]));
    within(s.teamHp, 391_390, 40, "team HP");
    within(s.teamRcv, 1_271, 8, "team RCV");
  });
});
