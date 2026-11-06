import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { readPngImage } from "../../../../scripts/lib/png-image.ts";
import { cleanOcrJapanese } from "./jp-text.ts";
import { findStagePopup, parseStageText } from "./stages.ts";

const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("findStagePopup", () => {
  it("finds the olive panel on the stage-popup sample and nothing on a plain detail screen", () => {
    const popup = findStagePopup(readPngImage(resolve(fixtures, "sample5-full-414.png")));
    assert.ok(popup, "popup not found");
    // Reference rows 1052–1742 of 2200 → 0.478–0.792 of the height.
    assert.ok(Math.abs(popup.top / 733 - 0.478) < 0.01, `top ${popup.top}`);
    assert.ok(Math.abs(popup.bottom / 733 - 0.792) < 0.01, `bottom ${popup.bottom}`);
    assert.equal(findStagePopup(readPngImage(resolve(fixtures, "sample1-full-414.png"))), null);
  });
});

describe("parseStageText", () => {
  // OCR output of the sample popup (jpn model, olive flattened), after clean-up.
  const raw = [
    "スキルを使用すると下記の順番で進化します。",
    "1段階目:プロデューザサーさん、よて見しないて見ててへ!",
    "Lu ターソン:7 (最大Lu.5 ターン3)",
    "Bターンの間、自分の攻撃力が3倍、ダメージ上限値が300億。",
    "[Lock] を解除し、 盤面を [Fire] [Water] [Wood] [Light] [Heal] に変化。スキルが進化。",
    "2段階目:楽しそうに見える?楽しいよ!   ターソン3",
    "Bターン人の間、最大HPが1.5倍、装人攻撃力が3倍。",
    "[Lock] を解除し、 盤面を [Fire] [Water] [Wood] [Light] [Heal] に変化。スキルが進化。",
    "最終段階:テンションならあがってるよ   ターンソン:",
    "自分以外のスキルが1ターソン溜まる。",
    "1ターン人人のの間、盤面が7X6マス。 シールドを3コっ破壊。",
    "使用後に1段階目に戻る。",
  ].join("\n");

  it("extracts three stages, their max-level turns and the loop marker", () => {
    const cleaned = raw.split("\n").map(cleanOcrJapanese).join("\n");
    const parsed = parseStageText(cleaned);
    assert.ok(parsed);
    assert.equal(parsed.kind, "evo-loop");
    assert.equal(parsed.stages.length, 3);
    assert.equal(parsed.stages[0].name, "プロデューザサーさん、よて見しないて見ててへ!");
    assert.equal(parsed.stages[0].turns, 3);
    assert.match(parsed.stages[0].body, /^Bターンの間、自分の攻撃力が3倍/);
    assert.match(parsed.stages[0].body, /\[Lock\] を解除し、盤面を\[Fire\] \[Water\]/);
    assert.equal(parsed.stages[1].name, "楽しそうに見える?楽しいよ!");
    assert.equal(parsed.stages[1].turns, 3);
    assert.equal(parsed.stages[2].final, true);
    assert.equal(parsed.stages[2].name, "テンションならあがってるよ");
    assert.equal(parsed.stages[2].turns, null);
    assert.match(parsed.stages[2].body, /^自分以外のスキルが1ターン溜まる。/);
  });

  it("accepts the max-level turns with OCR noise and a loop marker glued to the last body line", () => {
    const parsed = parseStageText(
      "1段階目:A\nLn ターン7 (最大 Lu.s ターン3)\n本文A\n最終段階:B ターン:1\n本文B。使用後に1 騰階目に戻る。"
    );
    assert.ok(parsed);
    assert.equal(parsed.kind, "evo-loop");
    assert.equal(parsed.stages[0].turns, 3);
    assert.equal(parsed.stages[1].body, "本文B。");
  });

  it("returns null when fewer than two stages are present", () => {
    assert.equal(parseStageText("1段階目:ほげ\n本文"), null);
    assert.equal(parseStageText(""), null);
  });

  it("reads an evolving (non-looping) list without the loop line", () => {
    const parsed = parseStageText("1段階目:A ターン:5\n本文A\n2段階目:B ターン:2\n本文B");
    assert.ok(parsed);
    assert.equal(parsed.kind, "evo");
    assert.deepEqual(
      parsed.stages.map((s) => [s.name, s.turns, s.body]),
      [
        ["A", 5, "本文A"],
        ["B", 2, "本文B"],
      ]
    );
  });
});
