import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPostTranslationGlossary,
  applyPreTranslationGlossary,
  cleanOcrJapanese,
  expandJapaneseNumbers,
  hasJapanese,
  toHalfWidth,
} from "./jp-text.ts";

describe("cleanOcrJapanese", () => {
  it("repairs the errors seen on the sample screenshots", () => {
    assert.equal(
      cleanOcrJapanese("2ターンのの間、ダメージ吸収と属性吸収を無効化、自分の ⏎ ダメージ上限値が350億。".replace(" ⏎ ", "\n")),
      "2ターンの間、ダメージ吸収と属性吸収を無効化、自分のダメージ上限値が350億。"
    );
    assert.equal(
      cleanOcrJapanese("火回復人の同時攻撃でダメージをB2%軽滞。攻撃力が120倍、4コンボ加算、固定10OO万ダメージ。"),
      "火回復の同時攻撃でダメージを82%軽減。攻撃力が120倍、4コンボ加算、固定1000万ダメージ。"
    );
    assert.equal(cleanOcrJapanese("より道お散歩のちから       Lu.最大 ター:5 |"), "より道お散歩のちから Lu.最大ターン:5");
  });

  it("converts full-width characters and keeps plain text untouched", () => {
    assert.equal(toHalfWidth("１２０％"), "120%");
    assert.equal(cleanOcrJapanese("7コンボでダメージを半減。"), "7コンボでダメージを半減。");
  });
});

describe("expandJapaneseNumbers", () => {
  it("expands 万 and 億", () => {
    assert.equal(expandJapaneseNumbers("上限値が350億。"), "上限値が35,000,000,000。");
    assert.equal(expandJapaneseNumbers("固定1000万ダメージ"), "固定10,000,000ダメージ");
    assert.equal(expandJapaneseNumbers("2.5万"), "25,000");
    assert.equal(expandJapaneseNumbers("1億5000万"), "150,000,000");
    assert.equal(expandJapaneseNumbers("2.8倍"), "2.8倍");
  });
});

describe("glossary", () => {
  it("protects PAD terms before translation", () => {
    assert.equal(
      applyPreTranslationGlossary("【落ちコンなし】ダメージ上限値が200億。"),
      "[No skyfall] damage cap が20,000,000,000。"
    );
  });

  it("normalises machine-translated English", () => {
    assert.equal(
      applyPostTranslationGlossary("Invalidates damage absorption, attack power is 120 times."),
      "void damage absorb, ATK is x120."
    );
  });

  it("detects Japanese script", () => {
    assert.equal(hasJapanese("ふたりの旅"), true);
    assert.equal(hasJapanese("Journey for Two"), false);
  });
});
