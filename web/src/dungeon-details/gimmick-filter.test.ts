import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyEffects,
  floorIsDim,
  spawnHasGimmick,
} from "./gimmick-filter.ts";

const soldier = [
  { raw: "2ターン：20億以上無効", gimmickIds: ["ダメジ無効"] },
  { raw: "【残り2体以下になると使用】", gimmickIds: [] },
  { raw: "3,200,000ダメージ+99ターン：攻撃力2倍", gimmickIds: [] },
];

const esper = [
  { raw: "【超根性：50%】", gimmickIds: ["根性", "超根性"] },
  { raw: "3ターン：12コンボ以下吸収", gimmickIds: ["ダメジ吸収", "コンボ無効"] },
  { raw: "11,500,000ダメージ+3ターン：落ちコンなし", gimmickIds: ["落ちコンなし"] },
  { raw: "【超根性発動時】", gimmickIds: ["根性", "超根性"] },
  { raw: "2ターン：操作時間激減", gimmickIds: ["操作時間短縮"] },
  { raw: "11,615,000ダメージ+全ドロップ変化", gimmickIds: [] },
];

describe("classifyEffects", () => {
  it("keeps on-entry lines in pre until an action header", () => {
    assert.deepEqual(classifyEffects(soldier), ["pre", "moveset", "moveset"]);
  });

  it("keeps the Super Resolve threshold with the on-entry kit", () => {
    assert.deepEqual(classifyEffects(esper), [
      "pre",
      "pre",
      "pre",
      "super-resolve",
      "super-resolve",
      "super-resolve",
    ]);
  });
});

describe("floorIsDim", () => {
  it("dims a floor only when no spawn has the gimmick in scope", () => {
    const bright = { effects: soldier };
    const dark = { effects: [{ raw: "5個生成", gimmickIds: [] }] };
    assert.equal(floorIsDim([bright, dark], null, "pre"), false);
    assert.equal(floorIsDim([bright, dark], "ダメジ無効", "pre"), false);
    assert.equal(floorIsDim([dark], "ダメジ無効", "pre"), true);
    assert.equal(floorIsDim([bright], "ダメジ無効", "super-resolve"), true);
  });
});

describe("spawnHasGimmick", () => {
  it("matches damage void only on entry for the soldier", () => {
    assert.equal(spawnHasGimmick(soldier, "ダメジ無効", "pre"), true);
    assert.equal(spawnHasGimmick(soldier, "ダメジ無効", "super-resolve"), false);
    assert.equal(spawnHasGimmick(soldier, "ダメジ無効", "all"), true);
  });

  it("matches absorb on entry and the time cut only when Super Resolve triggers", () => {
    assert.equal(spawnHasGimmick(esper, "ダメジ吸収", "pre"), true);
    assert.equal(spawnHasGimmick(esper, "ダメジ吸収", "super-resolve"), false);
    assert.equal(spawnHasGimmick(esper, "操作時間短縮", "pre"), false);
    assert.equal(spawnHasGimmick(esper, "操作時間短縮", "super-resolve"), true);
    assert.equal(spawnHasGimmick(esper, "操作時間短縮", "all"), true);
  });
});
