import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MonsterRecord } from "../../types.ts";
import {
  detransformableSlots,
  detransformMembers,
  transformableSlots,
  transformMembers,
  transformSources,
  transformTargets,
} from "./transform.ts";
import { emptyMember } from "./types.ts";

const record = (id: number, extra: Partial<MonsterRecord>): MonsterRecord =>
  ({ monster_id: id, name_en: `m${id}`, ...extra }) as MonsterRecord;

describe("team transform", () => {
  const monsters = new Map<number, MonsterRecord>([
    [13412, record(13412, { transform_to_ids: [13413] })],
    [13413, record(13413, { transform_to_ids: [], transform_from_ids: [13412], is_transform_form: 1 })],
    [8618, record(8618, { transform_from_ids: [8614] })],
    [8620, record(8620, { transform_from_ids: [8616, 8614] })],
    [8614, record(8614, { transform_to_ids: [8620, 8618] })],
    [13922, record(13922, {})],
  ]);
  const members = [
    { ...emptyMember("leader"), monsterId: "13412", level: 99 as const, eqId: "20" },
    { ...emptyMember("sub"), monsterId: "13922" },
    { ...emptyMember("sub"), monsterId: "8614" },
    { ...emptyMember("sub"), monsterId: "13413" },
    emptyMember("sub"),
    { ...emptyMember("leader"), monsterId: "777" },
  ];

  it("lists the slots that can transform", () => {
    assert.deepEqual(transformableSlots(members, monsters), [0, 2]);
    assert.deepEqual(transformTargets(undefined), []);
    assert.deepEqual(transformTargets(record(1, { transform_to_ids: null })), []);
  });

  it("swaps in the post-transform form and keeps the rest of the slot", () => {
    const next = transformMembers(members, monsters);
    assert.equal(next[0].monsterId, "13413");
    assert.equal(next[0].level, 120, "restarts at the top; the page clamps to 99");
    assert.equal(next[0].eqId, "20");
    assert.equal(next[0].role, "leader");
    assert.equal(next[1], members[1], "no transform: same object");
    assert.equal(next[2].monsterId, "8618", "lowest id among several forms");
    assert.equal(next[3], members[3], "already transformed");
    assert.equal(next[4], members[4]);
    assert.equal(next[5], members[5], "unknown record untouched");
  });

  it("lists the slots that can go back to the pre-transform form", () => {
    assert.deepEqual(detransformableSlots(members, monsters), [3]);
    assert.deepEqual(transformSources(undefined), []);
    assert.deepEqual(transformSources(monsters.get(8620)), [8614, 8616]);
  });

  it("swaps a post-transform card back and keeps the rest of the slot", () => {
    const transformed = transformMembers(members, monsters);
    const back = detransformMembers(transformed, monsters);
    assert.equal(back[0].monsterId, "13412");
    assert.equal(back[0].eqId, "20");
    assert.equal(back[0].role, "leader");
    assert.equal(back[0].level, 120, "restarts at the top; the page clamps to the cap");
    assert.equal(back[2].monsterId, "8614");
    assert.equal(back[1], transformed[1], "no transform link: same object");
    assert.equal(back[5], transformed[5], "unknown record untouched");
    const fromTwo = detransformMembers(
      [{ ...emptyMember("sub"), monsterId: "8620" }],
      monsters
    );
    assert.equal(fromTwo[0].monsterId, "8614", "lowest id among several pre-forms");
  });
});
