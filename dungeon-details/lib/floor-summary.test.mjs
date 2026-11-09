import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseFloorHeaderText,
  partCountFromEffects,
  repairGluedFloorLabels,
  splitGluedFloorDigits,
  summarizeFloors,
} from "./floor-summary.mjs";

describe("glued floor labels", () => {
  it("splits the digits so the floor sequence continues", () => {
    assert.deepEqual(splitGluedFloorDigits("12", 0), { floor: 1, count: 2 });
    assert.deepEqual(splitGluedFloorDigits("43", 3), { floor: 4, count: 3 });
    assert.deepEqual(splitGluedFloorDigits("103", 9), { floor: 10, count: 3 });
    assert.deepEqual(splitGluedFloorDigits("112", 10), { floor: 11, count: 2 });
    assert.equal(splitGluedFloorDigits("5", 4), null);
  });

  it("parses header text with and without the space", () => {
    assert.deepEqual(parseFloorHeaderText("B12体出現", 0), { floor: "B1", spawnNote: "2体出現" });
    assert.deepEqual(parseFloorHeaderText("B4 3体出現", 3), { floor: "B4", spawnNote: "3体出現" });
    assert.deepEqual(parseFloorHeaderText("B10", 9), { floor: "B10", spawnNote: null });
    assert.deepEqual(parseFloorHeaderText("乱入", 0), { floor: "乱入", spawnNote: null });
  });

  it("repairs stored labels whose digits equal the spawn note", () => {
    const { floors, repaired } = repairGluedFloorLabels([
      { floor: "B12", spawnNote: "12体出現" },
      { floor: "B23", spawnNote: "23体出現" },
      { floor: "B3", spawnNote: null },
      { floor: "B4", spawnNote: "4体出現" },
    ]);
    assert.equal(repaired, 2);
    assert.deepEqual(
      floors.map((f) => [f.floor, f.spawnNote]),
      [
        ["B1", "2体出現"],
        ["B2", "3体出現"],
        ["B3", null],
        ["B4", "4体出現"],
      ]
    );
  });

  it("keeps sparse tables as they are", () => {
    const input = [
      { floor: "B2", spawnNote: null },
      { floor: "B4", spawnNote: null },
    ];
    assert.equal(repairGluedFloorLabels(input).repaired, 0);
  });
});

describe("partCountFromEffects (AppMedia lines from the seeds)", () => {
  it("reads explicit counts", () => {
    assert.equal(partCountFromEffects(["【部位3箇所】"]), 3);
  });
  it("counts one HP line per part", () => {
    assert.equal(
      partCountFromEffects([
        "【左部位】HP:3000億 防御:0",
        "【右部位】HP:3000億 防御:0",
        "【部位1つ破壊時】",
        "【部位2つ破壊時】",
      ]),
      2
    );
  });
  it("adds the all-broken stage after the numbered ones", () => {
    assert.equal(
      partCountFromEffects(["部位", "【部位1箇所破壊時】", "【部位2箇所破壊時】", "【全ての部位破壊時】"]),
      3
    );
    assert.equal(
      partCountFromEffects([
        "【左部位：HP1兆 防御0】",
        "【右部位：HP2兆 防御0】",
        "【部位1個破壊時】",
        "【部位全破壊時】",
      ]),
      2
    );
  });
  it("reads 両方 as two parts and a bare part line as one", () => {
    assert.equal(partCountFromEffects(["部位", "【部位1個破壊時】", "【部位が両方破壊された時】"]), 2);
    assert.equal(partCountFromEffects(["【部位：HP5000億 防御0】", "【部位破壊時】"]), 1);
    assert.equal(partCountFromEffects(["スキル遅延1ターン"]), 0);
  });
});

describe("summarizeFloors", () => {
  it("gives each floor its hardest hit and part count", () => {
    const s = summarizeFloors([
      {
        floor: "B1",
        spawns: [{ monsterId: 1, effects: [{ raw: "1,000,000ダメージ" }, { raw: "10億ダメージ吸収" }] }],
      },
      {
        floor: "B2",
        spawns: [
          { monsterId: 2, effects: [{ raw: "【部位3箇所】" }, { raw: "2,193万ダメージの連続攻撃" }] },
        ],
      },
      { floor: "乱入", spawns: [] },
    ]);
    assert.deepEqual(
      s.map((f) => [f.index, f.label, f.floor, f.maxHit?.value ?? null, f.partCount]),
      [
        [1, "B1", 1, 1_000_000, null],
        [2, "B2", 2, 21_930_000, 3],
        [3, "乱入", null, null, null],
      ]
    );
  });
});

describe("parseDungeonFloorTable with glued labels", () => {
  it("keeps rowspan spawn rows on the same floor", async () => {
    const { parseDungeonFloorTable } = await import("./parse-dungeon-table.mjs");
    const row = (floorCell, id) =>
      `<tr>${floorCell}<td><img src="/icon/${id}.jpg" alt="${id}">HP 10万</td><td>${id},000ダメージ</td></tr>`;
    const html = `<h3>先制ギミック早見表</h3><table>
      <tr><th>階層</th><th>モンスター</th><th>先制</th></tr>
      ${row('<td rowspan="2">B12体出現</td>', 1)}
      ${row("", 2)}
      ${row('<td rowspan="3">B23体出現</td>', 3)}
      ${row("", 4)}
      ${row("", 5)}
      ${row("<td>B3</td>", 6)}
    </table>`;
    const floors = parseDungeonFloorTable(html, []);
    assert.deepEqual(
      floors.map((f) => [f.floor, f.spawnNote, f.spawns.length]),
      [
        ["B1", "2体出現", 2],
        ["B2", "3体出現", 3],
        ["B3", null, 1],
      ]
    );
  });
});
