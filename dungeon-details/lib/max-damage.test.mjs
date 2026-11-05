import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findMaxDamage, parseDamageValues } from "./max-damage.mjs";

describe("parseDamageValues", () => {
  it("reads comma-separated numbers before ダメージ", () => {
    assert.deepEqual(parseDamageValues("21,930,000ダメージの連続攻撃"), [21_930_000]);
  });

  it("keeps the boosted value of conditional attacks", () => {
    assert.deepEqual(
      parseDamageValues("4,000,000(7倍時：28,000,000)ダメージの連続攻撃"),
      [28_000_000]
    );
  });

  it("ignores lines without a number right before ダメージ", () => {
    assert.deepEqual(parseDamageValues("2ターン：被ダメージ75%軽減"), []);
    assert.deepEqual(parseDamageValues("3ターン：全員ダメージ上限値20億"), []);
    assert.deepEqual(parseDamageValues(""), []);
  });

  it("skips malformed digit groups and reports them", () => {
    const invalid = [];
    assert.deepEqual(
      parseDamageValues("7,800,0000ダメージ+2ターン：アシスト無効", (t, raw) => invalid.push([t, raw])),
      []
    );
    assert.deepEqual(invalid, [["7,800,0000", "7,800,0000ダメージ+2ターン：アシスト無効"]]);
    assert.deepEqual(parseDamageValues("12,34ダメージ"), []);
    assert.deepEqual(parseDamageValues("21930000ダメージ"), [21_930_000]);
  });

  it("ignores absorb / void thresholds", () => {
    assert.deepEqual(parseDamageValues("4ターン：10億ダメージ吸収"), []);
    assert.deepEqual(parseDamageValues("1,000,000ダメージ以上無効"), []);
    assert.deepEqual(parseDamageValues("5ターン：50%ダメージ軽減 + 1,000ダメージ"), [1000]);
  });

  it("converts 万 / 億 units", () => {
    assert.deepEqual(parseDamageValues("先制で2,193万ダメージ"), [21_930_000]);
    assert.deepEqual(parseDamageValues("約147.2万ダメージ"), [1_472_000]);
    assert.deepEqual(parseDamageValues("1.5億ダメージの連続攻撃"), [150_000_000]);
    assert.deepEqual(parseDamageValues("1.5ダメージ"), []);
  });

  it("reads sub-lines and multiple values", () => {
    assert.deepEqual(
      parseDamageValues("┗11,700,000ダメージ+全ドロップ暗闇 / 500ダメージ"),
      [11_700_000, 500]
    );
  });
});

describe("findMaxDamage", () => {
  const floors = [
    {
      floor: "B1",
      spawnNote: null,
      spawns: [
        {
          monsterId: 1,
          monsterNameJa: "A",
          effects: [{ raw: "1,000ダメージ" }, { raw: "被ダメージ半減" }],
        },
      ],
    },
    {
      floor: "B10",
      spawnNote: null,
      spawns: [
        {
          monsterId: 2,
          monsterNameJa: "B",
          effects: [{ raw: "21,930,000ダメージの連続攻撃" }],
        },
        {
          monsterId: 3,
          monsterNameJa: "C",
          effects: [{ raw: "21,930,000ダメージ" }],
        },
      ],
    },
  ];

  it("returns the first spawn that hits the maximum", () => {
    assert.deepEqual(findMaxDamage(floors), {
      value: 21_930_000,
      floor: "B10",
      monsterId: 2,
      monsterNameJa: "B",
      raw: "21,930,000ダメージの連続攻撃",
    });
  });

  it("ignores a malformed line and keeps the next best value", () => {
    const invalid = [];
    const result = findMaxDamage(
      [
        {
          floor: "B8",
          spawns: [{ monsterId: 9, monsterNameJa: "X", effects: [{ raw: "7,800,0000ダメージ" }, { raw: "500ダメージ" }] }],
        },
      ],
      (t) => invalid.push(t)
    );
    assert.equal(result?.value, 500);
    assert.deepEqual(invalid, ["7,800,0000"]);
  });

  it("returns null when no line carries a damage value", () => {
    assert.equal(findMaxDamage([]), null);
    assert.equal(
      findMaxDamage([{ floor: "B1", spawns: [{ effects: [{ raw: "x" }] }] }]),
      null
    );
    assert.equal(findMaxDamage(undefined), null);
  });
});
