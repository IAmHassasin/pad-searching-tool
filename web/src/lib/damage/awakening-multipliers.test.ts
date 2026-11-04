import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AWAKENING_MULTIPLIERS,
  awakeningIdsOfKind,
  awakeningStatMultipliers,
  DEFAULT_AWK_MODIFIER_SETTINGS,
  KILLER_AWAKENING_IDS,
} from "./awakening-multipliers.ts";
import {
  getAwakeningStatMultipliers,
  getModifierAwksForStat,
  MODIFIER_AWAKENING_IDS,
  statMultiplierLabel,
} from "../awakening-stat-modifier.ts";

const settings = DEFAULT_AWK_MODIFIER_SETTINGS;

describe("AWAKENING_MULTIPLIERS table", () => {
  it("covers every id listed in the modifier picker", () => {
    for (const id of MODIFIER_AWAKENING_IDS) {
      assert.ok(AWAKENING_MULTIPLIERS[id], `missing table entry for #${id}`);
    }
  });

  it("has a source on every entry", () => {
    for (const def of Object.values(AWAKENING_MULTIPLIERS)) {
      assert.ok(def.source, `#${def.id} has no source`);
      assert.equal(def.id, Number(def.id));
    }
  });

  it("lists killers with their target type", () => {
    assert.deepEqual(awakeningIdsOfKind("killer"), [...KILLER_AWAKENING_IDS]);
    assert.equal(AWAKENING_MULTIPLIERS[31].killerType, 4);
    assert.equal(AWAKENING_MULTIPLIERS[32].killerType, 5);
  });

  it("keeps pipeline-only kinds out of the stat multipliers", () => {
    for (const id of [22, 116, 73, 121, 14, 99, 45]) {
      assert.deepEqual(awakeningStatMultipliers(id, settings), {
        hp: 1,
        atk: 1,
        rcv: 1,
      });
    }
    assert.equal(AWAKENING_MULTIPLIERS[22].perUnit, 0.9);
    assert.equal(AWAKENING_MULTIPLIERS[116].perUnit, 0.9);
    assert.equal(AWAKENING_MULTIPLIERS[73].perUnit, 0.3);
    assert.equal(AWAKENING_MULTIPLIERS[121].perUnit, 0.6);
    assert.equal(AWAKENING_MULTIPLIERS[14].perUnit, 0.07);
    assert.equal(AWAKENING_MULTIPLIERS[99].perUnit, 0.14);
    assert.equal(AWAKENING_MULTIPLIERS[45].fixedDamage, 500_000);
    assert.equal(AWAKENING_MULTIPLIERS[50].fixedDamage, 10_000_000);
  });
});

describe("getAwakeningStatMultipliers (compat API)", () => {
  it("returns the unchanged values for a sample of ids", () => {
    assert.deepEqual(getAwakeningStatMultipliers(27, settings), { hp: 1, atk: 2.2, rcv: 1 });
    assert.deepEqual(getAwakeningStatMultipliers(96, settings), { hp: 1, atk: 4.84, rcv: 1 });
    assert.deepEqual(getAwakeningStatMultipliers(138, settings), { hp: 3, atk: 3, rcv: 3 });
    assert.deepEqual(
      getAwakeningStatMultipliers(130, { ...settings, agingBattle: 5 }),
      { hp: 1.5, atk: 1.5, rcv: 1.5 }
    );
    assert.deepEqual(
      getAwakeningStatMultipliers(130, { ...settings, agingBattle: 10 }),
      { hp: 2, atk: 2, rcv: 2 }
    );
    assert.deepEqual(getAwakeningStatMultipliers(48, settings), { hp: 1, atk: 3.5, rcv: 1 });
    assert.deepEqual(getAwakeningStatMultipliers(109, settings), { hp: 1, atk: 12.25, rcv: 1 });
    assert.deepEqual(getAwakeningStatMultipliers(82, settings), { hp: 1, atk: 12, rcv: 1 });
    assert.deepEqual(getAwakeningStatMultipliers(142, settings), { hp: 1.8, atk: 1.8, rcv: 1.8 });
    assert.deepEqual(getAwakeningStatMultipliers(63, settings), { hp: 1.1, atk: 1.1, rcv: 1.1 });
    assert.deepEqual(getAwakeningStatMultipliers(106, settings), { hp: 1, atk: 20, rcv: 1 });
    assert.deepEqual(getAwakeningStatMultipliers(144, settings), { hp: 1, atk: 100, rcv: 1 });
    assert.deepEqual(getAwakeningStatMultipliers(150, settings), { hp: 1, atk: 7, rcv: 1 });
    assert.deepEqual(getAwakeningStatMultipliers(31, settings), { hp: 1, atk: 5, rcv: 1 });
    assert.deepEqual(getAwakeningStatMultipliers(999, settings), { hp: 1, atk: 1, rcv: 1 });
  });

  it("keeps the combo / battle / parts options", () => {
    assert.equal(getAwakeningStatMultipliers(43, { ...settings, combo43: 7 }).atk, 2);
    assert.equal(getAwakeningStatMultipliers(43, { ...settings, combo43: 14 }).atk, 3);
    assert.equal(getAwakeningStatMultipliers(107, { ...settings, combo43: 7 }).atk, 4);
    assert.equal(getAwakeningStatMultipliers(107, { ...settings, combo43: 14 }).atk, 9);
    assert.equal(getAwakeningStatMultipliers(143, { ...settings, battle143: 3 }).atk, 30);
    assert.equal(getAwakeningStatMultipliers(143, { ...settings, battle143: 15 }).atk, 150);
    assert.equal(getAwakeningStatMultipliers(131, { ...settings, parts131: 0 }).atk, 1);
    assert.ok(
      Math.abs(getAwakeningStatMultipliers(131, { ...settings, parts131: 2 }).hp - 1.44) < 1e-9
    );
  });

  it("applies the updated values", () => {
    assert.deepEqual(getAwakeningStatMultipliers(57, settings), { hp: 1, atk: 10, rcv: 1 });
    assert.deepEqual(getAwakeningStatMultipliers(58, settings), { hp: 1, atk: 10, rcv: 1 });
    assert.deepEqual(getAwakeningStatMultipliers(72, settings), { hp: 1, atk: 10, rcv: 1 });
    assert.deepEqual(getAwakeningStatMultipliers(128, settings), { hp: 2, atk: 5, rcv: 2 });
    assert.deepEqual(getAwakeningStatMultipliers(129, settings), { hp: 2, atk: 5, rcv: 2 });
  });

  it("exposes 72 in the picker and labels it", () => {
    assert.ok(MODIFIER_AWAKENING_IDS.includes(72));
    assert.ok(getModifierAwksForStat("atk").includes(72));
    assert.ok(!getModifierAwksForStat("hp").includes(72));
    assert.equal(statMultiplierLabel(128), "HP×2, ATK×5, RCV×2");
  });
});
