import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  containsJapanese,
  translateMonsterNameRows,
  type CachedMonsterName,
} from "./japanese-name.ts";

describe("containsJapanese", () => {
  it("detects kana and kanji and ignores Latin names", () => {
    assert.equal(containsJapanese("極醒の葵風龍喚士・カエデ"), true);
    assert.equal(containsJapanese("カエデ"), true);
    assert.equal(containsJapanese("Claire"), false);
    assert.equal(containsJapanese("Twin Dragons"), false);
  });
});

describe("translateMonsterNameRows", () => {
  it("returns a Latin name without calling the translator", async () => {
    let calls = 0;
    const names = await translateMonsterNameRows(
      [{ monsterId: 1, nameEn: "Claire", nameJp: "クレア" }],
      new Map(),
      async () => {
        calls += 1;
        return ["should not run"];
      }
    );
    assert.equal(calls, 0);
    assert.equal(names["1"], "Claire");
  });

  it("translates a Japanese name once and reuses the cache", async () => {
    const cache = new Map<number, CachedMonsterName>();
    const seen: string[][] = [];
    const translateBatch = async (texts: string[]) => {
      seen.push(texts);
      return texts.map((text) => `EN:${text}`);
    };
    const row = {
      monsterId: 14223,
      nameEn: "極醒の葵風龍喚士・カエデの希石",
      nameJp: "極醒の葵風龍喚士・カエデの希石",
    };

    const first = await translateMonsterNameRows([row], cache, translateBatch);
    const second = await translateMonsterNameRows([row], cache, translateBatch);

    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0], ["極醒の葵風龍喚士・カエデの希石"]);
    assert.equal(first["14223"], "EN:極醒の葵風龍喚士・カエデの希石");
    assert.equal(second["14223"], first["14223"]);
  });

  it("keeps the Japanese name when translation throws and does not cache the failure", async () => {
    const cache = new Map<number, CachedMonsterName>();
    let calls = 0;
    const row = { monsterId: 9, nameEn: "カエデ", nameJp: null };
    const translateBatch = async () => {
      calls += 1;
      throw new Error("upstream down");
    };

    const first = await translateMonsterNameRows([row], cache, translateBatch);
    assert.equal(first["9"], "カエデ");
    assert.equal(cache.size, 0);

    await translateMonsterNameRows([row], cache, translateBatch);
    assert.equal(calls, 2);
  });

  it("translates name_jp when name_en is empty", async () => {
    const names = await translateMonsterNameRows(
      [{ monsterId: 3, nameEn: null, nameJp: "嵐操龍" }],
      new Map(),
      async (texts) => texts.map(() => "Storm Dragon")
    );
    assert.equal(names["3"], "Storm Dragon");
  });
});
