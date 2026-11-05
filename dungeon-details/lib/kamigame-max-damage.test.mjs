import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findMaxDamageInEnemyTables } from "./enemy-tables.mjs";
import { parseKamigameMaxDamage } from "./kamigame-max-damage.mjs";

const PAGE = `
<h2 id="a">出現する敵とギミック</h2>
<h3 id="b">出現する敵と注意点</h3>
<div><table class="wt">
<thead><tr><th>階層</th><th>敵/タイプ</th><th>注意点</th></tr></thead>
<tbody>
<tr><td>乱入<br>3/6F</td><td><img alt="木ソフィ"><img alt="悪魔タイプ"></td>
<td>【<em>先制</em>】<br>・4,000,000ダメージ<br>【部位破壊時】<br>・6,000,000ダメージ</td></tr>
<tr><td rowspan="2">5F</td><td><img alt="ボス"></td>
<td>・400,000ダメージ<br>・無言パンチ（8,000,000ダメージ）<br>・2,5000,000ダメージ</td></tr>
</tbody></table></div>
<h2 id="d">攻略パーティ</h2>
<table><tr><td>x</td><td>・99,000,000ダメージ</td></tr></table>
<p>固定50,000,000ダメージで突破</p>
`;

describe("parseKamigameMaxDamage", () => {
  it("reads the largest hit from the enemy table only", () => {
    const invalid = [];
    const result = parseKamigameMaxDamage(PAGE, (t) => invalid.push(t));
    assert.deepEqual(result, {
      value: 8_000_000,
      floor: "5F",
      monsterNameJa: "ボス",
      raw: "・無言パンチ（8,000,000ダメージ）",
    });
    assert.deepEqual(invalid, ["2,5000,000"]);
  });

  it("returns null without enemy tables", () => {
    assert.equal(parseKamigameMaxDamage("<h2>攻略</h2><p>1,000ダメージ</p>"), null);
  });
});

describe("findMaxDamageInEnemyTables", () => {
  it("keeps per-monster tables under an enemy section (AppMedia / Kamigame descended guides)", () => {
    const html = `
<h2>ドロシー降臨の出現モンスター</h2>
<div><h3>裏れもドラ</h3><table><tr><td>先制</td><td>13,320ダメージ</td></tr></table></div>
<div><h3>魔法と旅する者・ドロシー</h3><table><tr><td>HP50%以下</td><td>71.6万ダメージ<br>発狂</td></tr></table></div>
<h2>おすすめ周回パーティ</h2>
<table><tr><td>固定</td><td>5,000,000ダメージ</td></tr></table>`;
    const hit = findMaxDamageInEnemyTables(html);
    assert.equal(hit?.value, 716_000);
    assert.equal(hit?.heading, "魔法と旅する者・ドロシー");
    assert.equal(hit?.raw, "71.6万ダメージ");
  });

  it("accepts a table that mentions 先制 under any heading", () => {
    const html = `<h2>概要</h2><table><tr><td>先制で2,000ダメージ</td></tr></table>`;
    assert.equal(findMaxDamageInEnemyTables(html)?.value, 2000);
  });
});
