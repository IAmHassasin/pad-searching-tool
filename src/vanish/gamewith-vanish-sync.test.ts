import assert from "node:assert/strict";
import { describe, test } from "node:test";
import Database from "better-sqlite3";
import {
  buildAwokenNameIndex,
  buildVanishRows,
  normalizeAwokenName,
  parseGrantedAwokenNames,
  pruneVanishDelta,
  syncVanishDeltaRows,
  vanishReadSourceSql,
  vanishTableDdl,
  type SqlExec,
  type VanishRow,
} from "./gamewith-vanish-sync.ts";

function memoryDb(): { db: Database.Database; exec: SqlExec } {
  const db = new Database(":memory:");
  db.exec(`ATTACH DATABASE ':memory:' AS base`);
  db.exec(`ATTACH DATABASE ':memory:' AS delta`);
  db.exec(vanishTableDdl("base"));
  db.exec(vanishTableDdl("delta"));
  const exec: SqlExec = async (sql, params = []) => {
    const stmt = db.prepare(sql);
    if (stmt.reader) return stmt.all(...params) as unknown[];
    stmt.run(...params);
    return [];
  };
  return { db, exec };
}

function row(monsterId: number, ids: number[], text = "t"): VanishRow {
  return {
    monster_id: monsterId,
    awoken_skill_ids: JSON.stringify(ids),
    name_ja: `m${monsterId}`,
    skill_text: text,
  };
}

function insert(db: Database.Database, alias: string, r: VanishRow): void {
  db.prepare(
    `INSERT INTO ${alias}.monster_vanish_awoken (monster_id, awoken_skill_ids, name_ja, skill_text) VALUES (?, ?, ?, ?)`
  ).run(r.monster_id, r.awoken_skill_ids, r.name_ja, r.skill_text);
}

function ids(db: Database.Database, alias: string): number[] {
  return (
    db
      .prepare(`SELECT monster_id FROM ${alias}.monster_vanish_awoken ORDER BY monster_id`)
      .all() as { monster_id: number }[]
  ).map((r) => r.monster_id);
}

describe("name parsing", () => {
  test("normalizeAwokenName folds + and drops ・", () => {
    assert.equal(normalizeAwokenName(" スキル・ブースト+ "), "スキルブースト＋");
  });

  test("parseGrantedAwokenNames prefers the longest name", () => {
    const names = ["スキルブースト＋", "スキルブースト"].sort((a, b) => b.length - a.length);
    assert.deepEqual(
      parseGrantedAwokenNames("スキルブースト＋と<br>スキルブーストを付与", names),
      ["スキルブースト＋", "スキルブースト"]
    );
  });

  test("parseGrantedAwokenNames ignores text without を付与", () => {
    assert.deepEqual(parseGrantedAwokenNames("スキルブースト", ["スキルブースト"]), []);
  });
});

describe("buildAwokenNameIndex", () => {
  test("skips untranslated names and applies manual overrides", () => {
    const index = buildAwokenNameIndex(
      [
        { awoken_skill_id: 21, name_ja: "スキルブースト" },
        { awoken_skill_id: 56, name_ja: "Untranslated" },
      ],
      { _comment: "x", "スキルブースト+": 56, "未定": null }
    );
    assert.equal(index.get("スキルブースト"), 21);
    assert.equal(index.get("スキルブースト＋"), 56);
    assert.equal(index.has("未定"), false);
  });

  test("throws on conflicting normalized names", () => {
    assert.throws(() =>
      buildAwokenNameIndex(
        [
          { awoken_skill_id: 1, name_ja: "A+" },
          { awoken_skill_id: 2, name_ja: "A＋" },
        ],
        {}
      )
    );
  });

  test("rejects invalid manual ids", () => {
    assert.throws(() => buildAwokenNameIndex([], { A: "abc" }));
  });
});

describe("buildVanishRows", () => {
  const index = new Map([
    ["スキルブースト", 21],
    ["封印耐性", 10],
  ]);
  const awakenings = [{ 名前: "スキルブースト" }, { 名前: "封印耐性" }, { 名前: "新覚醒" }];

  test("keeps grant skills, skips unmapped and non-grant assists", () => {
    const result = buildVanishRows(
      [
        {
          図鑑番号: 100,
          正式名称: "A",
          スキル内容生成: "スキルブーストと封印耐性を付与",
          skillAttributes: { 覚醒付与スキル: true },
        },
        {
          図鑑番号: 101,
          スキル内容生成: "新覚醒を付与",
          skillAttributes: { 覚醒付与スキル: true },
        },
        { 図鑑番号: 102, スキル内容生成: "攻撃", skillAttributes: { 覚醒付与スキル: true } },
        { 図鑑番号: 103, スキル内容生成: "封印耐性を付与", skillAttributes: {} },
      ],
      awakenings,
      index
    );
    assert.deepEqual(result.rows, [
      {
        monster_id: 100,
        awoken_skill_ids: "[21,10]",
        name_ja: "A",
        skill_text: "スキルブーストと封印耐性を付与",
      },
    ]);
    assert.deepEqual(result.skippedIds, [101, 102]);
    assert.deepEqual(result.unmappedNames, ["新覚醒"]);
  });
});

describe("syncVanishDeltaRows", () => {
  test("writes only monsters missing from base", async () => {
    const { db, exec } = memoryDb();
    insert(db, "base", row(1, [21]));
    const result = await syncVanishDeltaRows(exec, {
      baseAlias: "base",
      deltaAlias: "delta",
      rows: [row(1, [10]), row(2, [21]), row(3, [10, 10])],
    });
    assert.deepEqual(ids(db, "delta"), [2, 3]);
    assert.deepEqual(ids(db, "base"), [1]);
    assert.equal(result.parsed, 3);
    assert.equal(result.inBase, 1);
    assert.equal(result.inserted, 2);
    assert.equal(result.updated, 0);
    assert.equal(result.deltaTotal, 2);
  });

  test("updates changed delta rows and leaves unchanged ones", async () => {
    const { db, exec } = memoryDb();
    insert(db, "delta", row(2, [21]));
    insert(db, "delta", row(3, [10]));
    const result = await syncVanishDeltaRows(exec, {
      baseAlias: "base",
      deltaAlias: "delta",
      rows: [row(2, [21]), row(3, [10, 21], "new text")],
    });
    assert.equal(result.inserted, 0);
    assert.equal(result.updated, 1);
    const updated = db
      .prepare(`SELECT awoken_skill_ids, skill_text FROM delta.monster_vanish_awoken WHERE monster_id = 3`)
      .get() as { awoken_skill_ids: string; skill_text: string };
    assert.deepEqual(updated, { awoken_skill_ids: "[10,21]", skill_text: "new text" });
  });

  test("duplicate monster ids in the parsed list do not fail the sync", async () => {
    const { db, exec } = memoryDb();
    const result = await syncVanishDeltaRows(exec, {
      baseAlias: "base",
      deltaAlias: "delta",
      rows: [row(4, [21]), row(4, [10])],
    });
    assert.equal(result.inserted, 1);
    assert.equal(result.updated, 1);
    assert.deepEqual(ids(db, "delta"), [4]);
  });

  test("prunes delta rows the base now covers", async () => {
    const { db, exec } = memoryDb();
    insert(db, "delta", row(5, [21]));
    insert(db, "delta", row(6, [21]));
    insert(db, "base", row(5, [21]));
    const result = await syncVanishDeltaRows(exec, {
      baseAlias: "base",
      deltaAlias: "delta",
      rows: [],
    });
    assert.equal(result.pruned, 1);
    assert.deepEqual(ids(db, "delta"), [6]);
    assert.equal(result.deltaTotal, 1);
  });

  test("without a base DB every parsed row goes to delta", async () => {
    const { db, exec } = memoryDb();
    const result = await syncVanishDeltaRows(exec, {
      baseAlias: null,
      deltaAlias: "delta",
      rows: [row(1, [21])],
    });
    assert.equal(result.inserted, 1);
    assert.equal(result.pruned, 0);
    assert.deepEqual(ids(db, "delta"), [1]);
  });
});

describe("vanishReadSourceSql", () => {
  test("base row wins over a duplicate delta row; delta fills gaps", () => {
    const { db } = memoryDb();
    insert(db, "base", row(1, [21]));
    insert(db, "delta", row(1, [10]));
    insert(db, "delta", row(2, [10]));
    const source = vanishReadSourceSql("base", "delta")!;
    const rows = db
      .prepare(
        `SELECT m.id AS id, _vanish.awoken_skill_ids AS ids FROM (SELECT 1 AS id UNION ALL SELECT 2 UNION ALL SELECT 3) AS m ` +
          `LEFT JOIN ${source} AS _vanish ON _vanish.monster_id = m.id ORDER BY m.id`
      )
      .all();
    assert.deepEqual(rows, [
      { id: 1, ids: "[21]" },
      { id: 2, ids: "[10]" },
      { id: 3, ids: null },
    ]);
  });

  test("single attached DB is used directly", () => {
    assert.equal(vanishReadSourceSql("base", null), "base.monster_vanish_awoken");
    assert.equal(vanishReadSourceSql(null, "delta"), "delta.monster_vanish_awoken");
    assert.equal(vanishReadSourceSql(null, null), null);
  });
});

describe("pruneVanishDelta", () => {
  test("returns 0 and keeps rows when nothing overlaps", async () => {
    const { db, exec } = memoryDb();
    insert(db, "delta", row(7, [21]));
    assert.equal(await pruneVanishDelta(exec, "base", "delta"), 0);
    assert.deepEqual(ids(db, "delta"), [7]);
  });
});
