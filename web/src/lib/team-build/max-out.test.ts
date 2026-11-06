import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MonsterRecord } from "../../types.ts";
import { maxOutMembers } from "./max-out.ts";
import { emptyMember } from "./types.ts";

const record = (id: number, extra: Partial<MonsterRecord>): MonsterRecord =>
  ({ monster_id: id, name_en: `m${id}`, ...extra }) as MonsterRecord;

describe("maxOutMembers", () => {
  const monsters = new Map<number, MonsterRecord>([
    [10, record(10, { limit_mult: 10 })],
    [20, record(20, { limit_mult: 0 })],
    [30, record(30, { limit_mult: 10, is_transform_form: 1 })],
  ]);

  it("raises level and plus points to the per-card cap", () => {
    const low = {
      ...emptyMember("sub"),
      plusHp: 0,
      plusAtk: 5,
      plusRcv: 0,
      eqPlusHp: 0,
      eqPlusRcv: 0,
      eqPlusAtk: 0,
      level: 99 as const,
    };
    const next = maxOutMembers(
      [
        { ...low, role: "leader", monsterId: "10" },
        { ...low, monsterId: "20" },
        { ...low, monsterId: "30", level: 120 },
        { ...low, monsterId: "40" },
        low,
      ],
      monsters
    );
    assert.equal(next[0].level, 120);
    assert.equal(next[1].level, 99, "no limit break stays at 99");
    assert.equal(next[2].level, 99, "transform form caps at 99");
    assert.equal(next[3].level, 120, "unknown record: 120, clamped later by the page");
    for (const m of next.slice(0, 4)) {
      assert.deepEqual(
        [m.plusHp, m.plusAtk, m.plusRcv, m.eqPlusHp, m.eqPlusAtk, m.eqPlusRcv],
        [99, 99, 99, 99, 99, 99]
      );
    }
    assert.equal(next[4], low, "empty slot untouched");
    assert.equal(next[0].role, "leader");
  });

  it("returns the same objects when nothing changes", () => {
    const maxed = { ...emptyMember("sub"), monsterId: "10" };
    const next = maxOutMembers([maxed], monsters);
    assert.equal(next[0], maxed);
  });
});
