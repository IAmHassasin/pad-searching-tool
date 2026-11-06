import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  jaccard,
  normalizeJa,
  SkillCorpusIndex,
  substituteNumbers,
  trigrams,
  type SkillCorpusEntry,
} from "./skill-corpus.ts";

const entries: SkillCorpusEntry[] = [
  {
    kind: "leader",
    id: 1,
    ja: "7コンボでダメージを半減。木と闇属性のHPが2.5倍。",
    en: "Reduces damage taken by 50% when making 7 combos; 2.5x HP for Wood and Dark Att.",
  },
  {
    kind: "active",
    id: 2,
    ja: "2ターンの間、ダメージ吸収と属性吸収を無効化、自分のダメージ上限値が300億。",
    en: "For 2 turns, voids damage absorb and attribute absorb; own damage cap becomes 30,000,000,000.",
  },
  {
    kind: "active",
    id: 3,
    ja: "ランダムで闇ドロップを3個生成。",
    en: "Creates 3 Dark orbs at random.",
  },
];

describe("normalizeJa / trigrams", () => {
  it("collapses digits and punctuation", () => {
    assert.equal(normalizeJa("７コンボで、ダメージを 半減。"), "#コンボでダメージを半減");
    assert.equal(normalizeJa("350億"), "#億");
    assert.deepEqual([...trigrams("abcd")], ["abc", "bcd"]);
    assert.equal(jaccard(trigrams("abcd"), trigrams("abcd")), 1);
  });
});

describe("SkillCorpusIndex", () => {
  const index = new SkillCorpusIndex(entries);

  it("finds the matching skill despite OCR noise and different numbers", () => {
    const [top] = index.match("2ターンのの間、ダメージ吸収と属性吸収を無効化、自分人のダメージ上限値が350億。", "active");
    assert.equal(top.entry.id, 2);
    assert.ok(top.score > 0.6, `score ${top.score}`);
  });

  it("filters by kind and ranks unrelated text low", () => {
    const leader = index.match("7コンボでダメージを半減。木と闇属性のHPが2.8倍。", "leader");
    assert.equal(leader[0].entry.id, 1);
    assert.ok(leader[0].score > 0.9);
    const none = index.match("7コンボでダメージを半減。", "active");
    assert.ok(none.every((m) => m.score < 0.3));
  });

  it("returns nothing for an empty query", () => {
    assert.deepEqual(index.match(""), []);
    assert.deepEqual(index.match("。、"), []);
  });
});

describe("substituteNumbers", () => {
  it("carries changed numbers into the English text", () => {
    const r = substituteNumbers(
      "7コンボでダメージを半減。木と闇属性のHPが2.8倍。",
      entries[0].ja,
      entries[0].en
    );
    assert.equal(r.en, "Reduces damage taken by 50% when making 7 combos; 2.8x HP for Wood and Dark Att.");
    assert.equal(r.substituted, 1);
    assert.equal(r.complete, true);
  });

  it("leaves the text alone when the number counts differ, and reports incomplete carries", () => {
    const same = substituteNumbers("闇ドロップを3個生成。", entries[2].ja, entries[2].en);
    assert.deepEqual(same, { en: entries[2].en, substituted: 0, complete: true });
    const differentCount = substituteNumbers("闇ドロップを3個生成。回復力が2倍。", entries[2].ja, entries[2].en);
    assert.deepEqual(differentCount, { en: entries[2].en, substituted: 0, complete: false });
    const r = substituteNumbers(
      "2ターンの間、上限値が350億。",
      "2ターンの間、上限値が300億。",
      "For 2 turns, damage cap becomes 30,000,000,000."
    );
    assert.equal(r.complete, false);
    assert.equal(r.en, "For 2 turns, damage cap becomes 30,000,000,000.");
  });
});
