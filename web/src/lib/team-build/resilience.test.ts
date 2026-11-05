import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MonsterRecord } from "../../types.ts";
import {
  computeResilience,
  describeDefensiveEffect,
  leaderShieldOf,
  listDefensiveOptions,
  parseActiveDefensiveEffects,
} from "./resilience.ts";
import { defaultTeamBuildConfig } from "./types.ts";

describe("parseActiveDefensiveEffects", () => {
  it("reads a shield with its duration", () => {
    assert.deepEqual(
      parseActiveDefensiveEffects(
        "For 2 turns, reduce damage taken by 100%; For 99 turns, enhanced orbs are more likely to appear by 15%"
      ),
      [{ kind: "shield", value: 1, turns: 2, stage: null }]
    );
  });

  it("reads an HP buff and ignores ATK / RCV multipliers", () => {
    assert.deepEqual(
      parseActiveDefensiveEffects(
        "For 2 turns, bypass att. absorb and damage absorb shield effects; For 2 turns, 4x HP; Charge all allies' skills by 3 turns"
      ),
      [{ kind: "hp", value: 4, turns: 2, stage: null }]
    );
    assert.deepEqual(
      parseActiveDefensiveEffects("For 6 turns, 4x ATK for Attacker and Machine types; For 8 turns, 3x RCV"),
      []
    );
  });

  it("does not treat 'recover x% of max HP' as an HP buff", () => {
    assert.deepEqual(
      parseActiveDefensiveEffects("For 7 turns, recover 35% of max HP; For 7 turns, increase combo count by 2"),
      []
    );
  });

  it("tags evolving actives with their stage", () => {
    const effects = parseActiveDefensiveEffects(
      "After each skill, evolve to the next: 1) Remove all awoken skill binds; For 1 turn, reduce damage taken by 35% 2) For 1 turn, reduce damage taken by 50% 3) For 1 turn, reduce damage taken by 50%; Remove 1 enemy's barrier"
    );
    assert.deepEqual(effects, [
      { kind: "shield", value: 0.35, turns: 1, stage: 1 },
      { kind: "shield", value: 0.5, turns: 1, stage: 2 },
      { kind: "shield", value: 0.5, turns: 1, stage: 3 },
    ]);
  });

  it("keeps both branches of a conditional active", () => {
    const effects = parseActiveDefensiveEffects(
      "For 3 turns, 2x ATK for all monsters; For 3 turns, reduce damage taken by 22%; If HP <= 50%: For 6 turns, 4x ATK for all monsters; For 6 turns, reduce damage taken by 44%"
    );
    assert.deepEqual(effects, [
      { kind: "shield", value: 0.22, turns: 3, stage: null },
      { kind: "shield", value: 0.44, turns: 6, stage: null },
    ]);
  });

  it("reads HP + shield from one looping active (stage 1 HP, stage 2 nothing)", () => {
    const effects = parseActiveDefensiveEffects(
      "After each skill, evolve to the next looping around if the end is reached: 1) For 1 turn, 2.5x orb move time; For 1 turn, 2.5x RCV; For 1 turn, 2.5x HP; Unlock all orbs 2) For 2 turns, bypass void damage shield effects; For 2 turns, 2x ATK for Wood and Light Att."
    );
    assert.deepEqual(effects, [{ kind: "hp", value: 2.5, turns: 1, stage: 1 }]);
  });

  it("skips per-awakening shields that scale with the team", () => {
    assert.deepEqual(
      parseActiveDefensiveEffects(
        "For 3 turns, reduce damage taken by 8% for each Skill Boost awoken skill on the team; For 3 turns, 2x HP"
      ),
      [{ kind: "hp", value: 2, turns: 3, stage: null }]
    );
  });

  it("returns nothing for empty text", () => {
    assert.deepEqual(parseActiveDefensiveEffects(null), []);
    assert.deepEqual(parseActiveDefensiveEffects("  "), []);
  });
});

describe("listDefensiveOptions", () => {
  it("lists card and assist actives with their slot", () => {
    const config = defaultTeamBuildConfig();
    config.members[4] = { ...config.members[4], monsterId: "1", eqId: "2" };
    config.members[5] = { ...config.members[5], monsterId: "3", eqId: "" };
    const rows = new Map<number, MonsterRecord>([
      [1, { monster_id: 1, name_en: "Denken", active_skill_name_en: "Lightning", active_skill_desc_en: "Unlock all orbs" }],
      [2, { monster_id: 2, name_en: "Crowns", active_skill_name_en: "Gale", active_skill_desc_en: "For 2 turns, 4x HP" }],
      [3, { monster_id: 3, name_en: "Egg", active_skill_name_en: "Miracle", active_skill_desc_en: "For 2 turns, reduce damage taken by 100%" }],
    ]);
    const options = listDefensiveOptions(config, rows);
    assert.deepEqual(
      options.map((o) => [o.id, o.slotIndex, o.source, o.monsterName, o.effect.kind, o.effect.value]),
      [
        ["4-assist-hp-0", 4, "assist", "Crowns", "hp", 4],
        ["5-card-shield-0", 5, "card", "Egg", "shield", 1],
      ]
    );
  });
});

describe("computeResilience", () => {
  it("multiplies HP buff and shields, strict survival", () => {
    const r = computeResilience({
      teamHp: 391_392,
      leaderShields: [0.5, 0.5],
      hpBuff: 2,
      activeShield: 0.75,
      maxDamage: 21_930_000,
    });
    assert.equal(r.effectiveMaxHp, 782_784);
    assert.equal(Number(r.totalReduction.toFixed(4)), 0.9375);
    assert.equal(r.damageTaken, 1_370_625);
    assert.equal(r.survives, false);
    assert.equal(r.margin, 782_784 - 1_370_625);
    assert.equal(Math.round(r.effectiveHp), 12_524_544);
  });

  it("passes when the hit is below the effective HP", () => {
    const r = computeResilience({
      teamHp: 1_000_000,
      leaderShields: [],
      hpBuff: null,
      activeShield: 0.5,
      maxDamage: 1_999_999,
    });
    assert.equal(r.damageTaken, 1_000_000);
    assert.equal(r.survives, false);
    const ok = computeResilience({
      teamHp: 1_000_001,
      leaderShields: [],
      hpBuff: null,
      activeShield: 0.5,
      maxDamage: 1_999_999,
    });
    assert.equal(ok.survives, true);
  });

  it("treats a 100% shield as infinite effective HP", () => {
    const r = computeResilience({
      teamHp: 10,
      leaderShields: [],
      hpBuff: null,
      activeShield: 1,
      maxDamage: 5_000_000,
    });
    assert.equal(r.effectiveHp, Infinity);
    assert.equal(r.damageTaken, 0);
    assert.equal(r.survives, true);
  });

  it("reports unknown when the dungeon has no damage value", () => {
    const r = computeResilience({
      teamHp: 10,
      leaderShields: [0.25],
      hpBuff: 1.5,
      activeShield: null,
      maxDamage: null,
    });
    assert.equal(r.effectiveMaxHp, 15);
    assert.equal(r.survives, null);
    assert.equal(r.damageTaken, null);
    assert.equal(r.margin, null);
  });
});

describe("helpers", () => {
  it("leaderShieldOf clamps and defaults", () => {
    assert.equal(leaderShieldOf({ leader_skill_max_shield: 0.5 }), 0.5);
    assert.equal(leaderShieldOf({ leader_skill_max_shield: null }), 0);
    assert.equal(leaderShieldOf(null), 0);
    assert.equal(leaderShieldOf({ leader_skill_max_shield: 3 }), 1);
  });

  it("describeDefensiveEffect formats both kinds", () => {
    assert.equal(
      describeDefensiveEffect({ kind: "shield", value: 0.75, turns: 1, stage: null }),
      "75% shield · 1 turn"
    );
    assert.equal(
      describeDefensiveEffect({ kind: "hp", value: 4, turns: 2, stage: 2 }),
      "4x HP · 2 turns · stage 2"
    );
  });
});
