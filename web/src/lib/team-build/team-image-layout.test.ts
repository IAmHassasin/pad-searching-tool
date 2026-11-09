import { test } from "node:test";
import assert from "node:assert/strict";
import type { MonsterRecord } from "../../types.ts";
import {
  TEAM_IMAGE_GAP_PX,
  TEAM_IMAGE_ICON_PX,
  TEAM_IMAGE_LEADER_GAP_PX,
  TEAM_IMAGE_ROW_GAP_PX,
  buildTeamImageLayout,
  teamImagePlusLabel,
} from "./team-image-layout.ts";
import { defaultTeamBuildConfig, emptyMember } from "./types.ts";

const LB_MONSTER = { monster_id: 13692, limit_mult: 30 } as MonsterRecord;
const NO_LB_MONSTER = { monster_id: 4454, limit_mult: 0 } as MonsterRecord;
const lookup = (id: number) => (id === 13692 ? LB_MONSTER : id === 4454 ? NO_LB_MONSTER : null);

test("plus label: +297, +891, hidden at +0, per stat otherwise", () => {
  const m = emptyMember("sub");
  assert.deepEqual(teamImagePlusLabel(m), { kind: "total", text: "+297" });
  assert.deepEqual(teamImagePlusLabel({ ...m, plusHp: 297, plusAtk: 297, plusRcv: 297 }), {
    kind: "total",
    text: "+891",
  });
  assert.deepEqual(teamImagePlusLabel({ ...m, plusHp: 0, plusAtk: 0, plusRcv: 0 }), { kind: "none" });
  assert.deepEqual(teamImagePlusLabel({ ...m, plusHp: 99, plusAtk: 0, plusRcv: 50 }), {
    kind: "perStat",
    lines: ["+99 HP", "+0 ATK", "+50 RCV"],
  });
});

test("no assist: single row, leader and helper separated from the subs", () => {
  const config = defaultTeamBuildConfig();
  config.members[0] = { ...config.members[0], monsterId: "13692" };
  const layout = buildTeamImageLayout(config.members, lookup);
  const stride = TEAM_IMAGE_ICON_PX + TEAM_IMAGE_GAP_PX;

  assert.equal(layout.cardRowY, 0);
  assert.equal(layout.height, TEAM_IMAGE_ICON_PX);
  assert.deepEqual(
    layout.slots.map((s) => s.x),
    [0, 1, 2, 3, 4, 5].map((i) => i * stride + (i >= 1 ? TEAM_IMAGE_LEADER_GAP_PX : 0) + (i >= 5 ? TEAM_IMAGE_LEADER_GAP_PX : 0))
  );
  assert.equal(layout.width, layout.slots[5].x + TEAM_IMAGE_ICON_PX);
  assert.equal(layout.slots.filter((s) => s.card == null).length, 5);
});

test("assist row above the card, level clamped to the card's cap", () => {
  const config = defaultTeamBuildConfig();
  config.members[0] = { ...config.members[0], monsterId: "13692", eqId: "13022", level: 120, selectedSuperAwakening: 137 };
  config.members[1] = { ...config.members[1], monsterId: "4454", eqId: "1", level: 120 };
  const layout = buildTeamImageLayout(config.members, lookup);

  assert.equal(layout.cardRowY, TEAM_IMAGE_ICON_PX + TEAM_IMAGE_ROW_GAP_PX);
  assert.deepEqual(layout.slots[0].assist, { monsterId: 13022, x: 0, y: 0 });
  assert.equal(layout.slots[0].card?.level, 120);
  assert.equal(layout.slots[0].card?.superAwakeningId, 137);
  assert.equal(layout.slots[1].assist, null);
  assert.equal(layout.slots[1].card?.level, 99);
  assert.equal(layout.slots[1].card?.y, layout.cardRowY);
});
