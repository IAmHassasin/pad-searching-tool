import assert from "node:assert/strict";
import { test } from "node:test";
import { countTeamAwakenings, slotAwakeningIds } from "./team-awakenings.ts";
import type { TeamMemberConfig } from "./types.ts";
import type { MonsterRecord } from "../../types.ts";

const member = (over: Partial<TeamMemberConfig> = {}): TeamMemberConfig =>
  ({
    monsterId: "1",
    eqId: "",
    level: 99,
    plusHp: 0,
    plusAtk: 0,
    plusRcv: 0,
    eqPlusHp: 0,
    eqPlusAtk: 0,
    eqPlusRcv: 0,
    selectedSuperAwakening: null,
    role: "sub",
    ...over,
  }) as TeamMemberConfig;

const monster = (awakenings: string, sync?: number): MonsterRecord =>
  ({ monster_id: 1, awakenings, sync_awsid: sync ?? null }) as unknown as MonsterRecord;

test("slotAwakeningIds: card regular + sync + chosen super, assist only with Awoken Assist", () => {
  const ids = slotAwakeningIds({
    member: member({ selectedSuperAwakening: 61 }),
    monster: monster("(10),(11)", 70),
    eq: monster("(49),(10),(27)"),
  });
  assert.deepEqual(ids.card, [10, 11, 70, 61]);
  assert.deepEqual(ids.assist, [10, 27]);

  const noGrant = slotAwakeningIds({ member: member(), monster: monster("(10)"), eq: monster("(10),(27)") });
  assert.deepEqual(noGrant.assist, []);
});

test("countTeamAwakenings: sums cards and assists, sorted by total then id", () => {
  const rows = countTeamAwakenings([
    { member: member(), monster: monster("(10),(10),(27)"), eq: monster("(49),(10)") },
    { member: member(), monster: monster("(27),(11)"), eq: null },
    { member: member(), monster: null, eq: monster("(49),(10)") },
  ]);
  assert.deepEqual(rows, [
    { id: 10, fromCards: 2, fromAssists: 1, total: 3 },
    { id: 27, fromCards: 2, fromAssists: 0, total: 2 },
    { id: 11, fromCards: 1, fromAssists: 0, total: 1 },
  ]);
});
