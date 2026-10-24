import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatLeaderSkillEhp, leaderSkillEhp } from "./leader-ehp.ts";

describe("leaderSkillEhp", () => {
  it("divides HP mult by the remaining damage after shield", () => {
    const row = { leader_skill_max_hp: 2.8, leader_skill_max_shield: 0.5 };
    assert.equal(leaderSkillEhp(row), 5.6);
    assert.equal(formatLeaderSkillEhp(row), "5.6x");
  });

  it("treats a missing shield as no damage reduction", () => {
    assert.equal(
      leaderSkillEhp({ leader_skill_max_hp: 1.5, leader_skill_max_shield: null }),
      1.5
    );
  });

  it("returns null when leader skill stats are unavailable", () => {
    assert.equal(leaderSkillEhp({}), null);
    assert.equal(formatLeaderSkillEhp({}), "—");
    assert.equal(
      leaderSkillEhp({ leader_skill_max_hp: 1, leader_skill_max_shield: 1 }),
      null
    );
  });
});
