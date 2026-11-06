import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseJpTypeLabels } from "./jp-types.ts";

describe("parseJpTypeLabels", () => {
  it("maps the labels of the four sample screens", () => {
    assert.deepEqual(parseJpTypeLabels("バランス"), [1]);
    assert.deepEqual(parseJpTypeLabels("回復"), [3]);
    assert.deepEqual(parseJpTypeLabels("体力"), [2]);
    assert.deepEqual(parseJpTypeLabels("悪魔 攻撃"), [7, 6]);
  });

  it("keeps reading order and ignores OCR noise around the labels", () => {
    assert.deepEqual(parseJpTypeLabels("| ドラゴン  神 ."), [4, 5]);
    assert.deepEqual(parseJpTypeLabels("強化合成用"), [14]);
    assert.deepEqual(parseJpTypeLabels("人体カ"), [2]);
  });

  it("returns nothing for text without a known label", () => {
    assert.deepEqual(parseJpTypeLabels("タロミンバタケタ"), []);
    assert.deepEqual(parseJpTypeLabels(""), []);
  });
});
