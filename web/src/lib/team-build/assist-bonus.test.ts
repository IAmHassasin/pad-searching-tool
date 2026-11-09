import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MonsterRecord } from "../../types.ts";
import { assistBonusPlus, computeAssistBonus } from "./assist-bonus.ts";

const record = (id: number, extra: Partial<MonsterRecord>): MonsterRecord =>
  ({ monster_id: id, name_en: `m${id}`, awakenings: "", ...extra }) as MonsterRecord;

describe("computeAssistBonus", () => {
  const base = record(1, { attribute_1_id: 0 });
  const assist = record(2, { attribute_1_id: 0, hp_max: 1000, atk_max: 500, rcv_max: 300 });

  it("counts plus points up to +99 per stat", () => {
    // (1000 + 99 × 10) × 10 %, (500 + 99 × 5) × 5 %, (300 + 99 × 3) × 15 %.
    assert.deepEqual(computeAssistBonus(base, assist, 99, 99, 99, 99), {
      hp: 199,
      atk: 50,
      rcv: 90,
    });
  });

  it("ignores limit-break plus above +99 per stat", () => {
    assert.deepEqual(
      computeAssistBonus(base, assist, 99, 297, 297, 297),
      computeAssistBonus(base, assist, 99, 99, 99, 99)
    );
  });

  it("clamps odd plus input", () => {
    assert.equal(assistBonusPlus(150), 99);
    assert.equal(assistBonusPlus(-3), 0);
    assert.equal(assistBonusPlus(Number.NaN), 0);
    assert.equal(assistBonusPlus(42), 42);
  });
});
