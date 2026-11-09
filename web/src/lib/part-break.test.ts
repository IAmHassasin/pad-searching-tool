import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MonsterRecord } from "../types.ts";
import {
  computeMonsterStatMultipliers,
  DEFAULT_AWK_MODIFIER_SETTINGS,
} from "./awakening-stat-modifier.ts";
import { clampPartsBroken, partBreakMultiplier } from "./part-break.ts";
import { computeTeamStats } from "./team-build/compute-stats.ts";
import { sanitizeTeamBuildConfig } from "./team-build/team-draft-storage.ts";
import { defaultTeamBuildConfig, type TeamBuildConfig } from "./team-build/types.ts";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

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

function teamWith(partsBroken: number, extra: Partial<TeamBuildConfig> = {}): TeamBuildConfig {
  const base = defaultTeamBuildConfig();
  return {
    ...base,
    ...extra,
    partsBroken,
    members: base.members.map((m, i) =>
      i === 0 ? { ...m, monsterId: "1", level: 99, plusHp: 0, plusAtk: 0, plusRcv: 0 } : m
    ),
  };
}

describe("partBreakMultiplier", () => {
  it("adds copies to the per-part rate and multiplies per part", () => {
    close(partBreakMultiplier(1, 1), 1.2);
    close(partBreakMultiplier(2, 1), 1.4);
    close(partBreakMultiplier(3, 1), 1.6);
    close(partBreakMultiplier(2, 2), 1.96);
    close(partBreakMultiplier(1, 3), 1.728);
  });

  it("is neutral without copies or parts and clamps the part count", () => {
    assert.equal(partBreakMultiplier(0, 5), 1);
    assert.equal(partBreakMultiplier(2, 0), 1);
    assert.equal(clampPartsBroken(42), 10);
    assert.equal(clampPartsBroken(-1), 0);
    assert.equal(clampPartsBroken(Number.NaN), 0);
  });
});

describe("Part Break Bonus in the manual awakening modifier", () => {
  it("treats two copies as ×1.4 per part, not ×1.2²", () => {
    const row = monster(1, { awakenings: "(131),(131)" });
    const m = computeMonsterStatMultipliers(row, {
      ...DEFAULT_AWK_MODIFIER_SETTINGS,
      enabled: [131],
      parts131: 2,
    });
    close(m.hp, 1.96);
  });
});

describe("Part Break Bonus in team stats", () => {
  it("applies the team's broken-part count to cards with the awakening", () => {
    const map = new Map([[1, monster(1, { awakenings: "(131),(131)" })]]);
    const s = computeTeamStats(teamWith(2), map);
    assert.equal(s.members[0].hp.afterAwk, 1960);
    assert.equal(s.teamHp, 1960);
    // The team-screen raw value never includes the battle-only bonus.
    assert.equal(s.members[0].hp.afterRaw, 1000);
  });

  it("counts the selected super awakening as one more copy", () => {
    const row = monster(1, { awakenings: "(131)", super_awakenings: "(131),(27)" });
    const cfg = teamWith(1);
    cfg.members[0] = { ...cfg.members[0], selectedSuperAwakening: 131 };
    assert.equal(computeTeamStats(cfg, new Map([[1, row]])).teamHp, 1400);
  });

  it("ignores 131 in the manual awakening list", () => {
    const map = new Map([[1, monster(1, { awakenings: "(131)" })]]);
    const cfg = teamWith(0, {
      awkSettings: { ...DEFAULT_AWK_MODIFIER_SETTINGS, enabled: [131], parts131: 10 },
    });
    assert.equal(computeTeamStats(cfg, map).teamHp, 1000);
  });

  it("leaves cards without the awakening alone", () => {
    const map = new Map([[1, monster(1)]]);
    assert.equal(computeTeamStats(teamWith(5), map).teamHp, 1000);
  });
});

describe("partsBroken draft migration", () => {
  it("takes parts131 from older drafts only when 131 was enabled", () => {
    const on = sanitizeTeamBuildConfig({ awkSettings: { enabled: [131], parts131: 3 } });
    const off = sanitizeTeamBuildConfig({ awkSettings: { enabled: [], parts131: 3 } });
    const explicit = sanitizeTeamBuildConfig({ partsBroken: 4, awkSettings: { enabled: [131], parts131: 3 } });
    assert.equal(on.partsBroken, 3);
    assert.equal(off.partsBroken, 0);
    assert.equal(explicit.partsBroken, 4);
    assert.equal(sanitizeTeamBuildConfig({ partsBroken: 99 }).partsBroken, 10);
  });
});
