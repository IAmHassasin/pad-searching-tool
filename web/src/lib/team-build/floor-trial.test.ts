import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DungeonFloorSummary } from "../../dungeon-details/types.ts";
import type { MonsterRecord } from "../../types.ts";
import { DEFAULT_AWK_MODIFIER_SETTINGS } from "../awakening-stat-modifier.ts";
import { neutralDungeonModifiers } from "./dungeon-modifiers.ts";
import {
  agingStageForFloor,
  buildHpTimeline,
  defaultPartsBroken,
  hasUsableFloorTable,
  heavyFloors,
  partsBrokenBefore,
  teamHpAtState,
  totalPartsBroken,
  type FloorState,
} from "./floor-trial.ts";
import { defaultTeamBuildConfig } from "./types.ts";

function floor(index: number, label: string, hit: number | null, partCount: number | null = null): DungeonFloorSummary {
  const m = /^B(\d+)$/.exec(label);
  return {
    index,
    label,
    floor: m ? Number(m[1]) : null,
    maxHit: hit == null ? null : { value: hit, monsterId: null, monsterNameJa: null, raw: `${hit}ダメージ` },
    partCount,
  };
}

// The user's example: B5 has 3 parts (2 broken), B10 has 5 (all broken).
const FLOORS = [
  floor(1, "乱入", 900, 1),
  ...Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    return floor(n + 1, `B${n}`, n === 11 ? 1000 : n === 6 ? 600 : 100, n === 5 ? 3 : n === 10 ? 5 : null);
  }),
];

/** Fake HP model: base 1000, Aging ×1.5 / ×2, ×1.2 per part (one copy). */
const hpAt = (s: FloorState) =>
  Math.round(1000 * (s.aging === 10 ? 2 : s.aging === 5 ? 1.5 : 1) * Math.pow(1.2, s.partsBroken));

describe("floor trial", () => {
  it("maps floors to Aging stages", () => {
    assert.deepEqual([4, 5, 9, 10, 15].map(agingStageForFloor), [0, 5, 5, 10, 10]);
    assert.equal(agingStageForFloor(null), 0);
  });

  it("defaults to every part on numbered floors and none on 乱入", () => {
    const d = defaultPartsBroken(FLOORS);
    assert.equal(d.get(1), 0);
    assert.equal(d.get(6), 3);
    assert.equal(d.get(11), 5);
  });

  it("counts parts from earlier floors only (applies from the next floor)", () => {
    const parts = new Map([[6, 2], [11, 5]]);
    const b5 = FLOORS.find((f) => f.label === "B5")!;
    const b6 = FLOORS.find((f) => f.label === "B6")!;
    const b11 = FLOORS.find((f) => f.label === "B11")!;
    assert.equal(partsBrokenBefore(FLOORS, b5, parts), 0);
    assert.equal(partsBrokenBefore(FLOORS, b6, parts), 2);
    assert.equal(partsBrokenBefore(FLOORS, b11, parts), 7);
  });

  it("clamps the broken count to the floor's parts", () => {
    const b6 = FLOORS.find((f) => f.label === "B6")!;
    assert.equal(partsBrokenBefore(FLOORS, b6, new Map([[6, 9]])), 3);
  });

  it("lists HP only where it changes", () => {
    const rows = buildHpTimeline(FLOORS, new Map([[6, 2], [11, 5]]), hpAt);
    assert.deepEqual(
      rows.map((r) => [r.fromLabel, r.hp, r.reasons.join(" + ")]),
      [
        ["B1", 1000, ""],
        ["B5", 1500, "Aging ×1.5"],
        ["B6", 2160, "+2 parts after B5"], // 1500 × 1.2²
        ["B10", 2880, "Aging ×2"], // 2000 × 1.2²
        ["B11", 7166, "+5 parts after B10"], // 2000 × 1.2⁷
      ]
    );
  });

  it("totals every broken part (乱入 included) for the team stats", () => {
    assert.equal(totalPartsBroken(FLOORS, defaultPartsBroken(FLOORS)), 8);
    assert.equal(totalPartsBroken(FLOORS, new Map([[1, 1], [6, 2], [11, 9]])), 8);
  });

  it("uses the floor table only when it lists hits", () => {
    assert.equal(hasUsableFloorTable(FLOORS), true);
    assert.equal(hasUsableFloorTable([floor(1, "B1", null, 2)]), false);
    assert.equal(hasUsableFloorTable(undefined), false);
  });

  it("keeps floors with at least half of the dungeon's hardest hit", () => {
    assert.deepEqual(heavyFloors(FLOORS).map((f) => f.label), ["乱入", "B6", "B11"]);
    assert.deepEqual(heavyFloors([floor(1, "B1", null)]), []);
  });
});

describe("teamHpAtState", () => {
  const card = (awakenings: string): MonsterRecord => ({
    monster_id: 1,
    name_en: "Card",
    hp_max: 1000,
    atk_max: 500,
    rcv_max: 200,
    limit_mult: 0,
    exp: 4_000_000,
    attribute_1_id: 0,
    type_1_id: 5,
    awakenings,
    leader_skill_desc_en: "",
  });
  const config = (() => {
    const c = defaultTeamBuildConfig();
    c.members[0] = { ...c.members[0], monsterId: "1", level: 99, plusHp: 0, plusAtk: 0, plusRcv: 0 };
    return c;
  })();

  it("applies Aging by floor and parts by state, ignoring the manual Aging toggle", () => {
    const map = new Map([[1, card("(130),(131)")]]);
    const dungeon = neutralDungeonModifiers({
      ...config,
      awkSettings: { ...DEFAULT_AWK_MODIFIER_SETTINGS, enabled: [130], agingBattle: 10 },
    });
    assert.equal(teamHpAtState(config, map, dungeon, { aging: 0, partsBroken: 0 }), 1000);
    assert.equal(teamHpAtState(config, map, dungeon, { aging: 5, partsBroken: 0 }), 1500);
    assert.equal(teamHpAtState(config, map, dungeon, { aging: 10, partsBroken: 2 }), 2880);
  });

  it("leaves cards without the awakenings unchanged", () => {
    const map = new Map([[1, card("")]]);
    const dungeon = neutralDungeonModifiers(config);
    assert.equal(teamHpAtState(config, map, dungeon, { aging: 10, partsBroken: 3 }), 1000);
  });
});
