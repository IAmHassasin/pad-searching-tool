import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Database from "better-sqlite3";
import { projectSourceRow } from "../transform/source-row-projection.ts";
import {
  buildNameSearchMatchSql,
  escapeLikeContains,
} from "./search-group-match.ts";

type Hit = {
  monster_id: number;
  name_en: string;
  matched_group_name: string | null;
  matched_group_kind: string | null;
};

function quote(column: string): string {
  return `"${column}"`;
}

function seed(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE monsters (
      monster_id INTEGER PRIMARY KEY,
      monster_no_na INTEGER,
      name_en TEXT,
      group_id INTEGER,
      base_id INTEGER,
      type_1_id INTEGER,
      type_2_id INTEGER,
      type_3_id INTEGER
    );
    CREATE TABLE series (
      series_id INTEGER PRIMARY KEY,
      name_en TEXT,
      series_type TEXT
    );
    CREATE TABLE monster_series (
      monster_id INTEGER,
      series_id INTEGER,
      priority INTEGER
    );
    CREATE TABLE transformations (to_monster_id INTEGER);
  `);

  const monster = db.prepare(
    `INSERT INTO monsters (
       monster_id, monster_no_na, name_en, group_id, base_id, type_1_id
     ) VALUES (?, ?, ?, ?, ?, ?)`
  );
  monster.run(1, 101, "Deku", 282, 1, 1);
  monster.run(2, null, "Deku, Evolved", 282, 1, 1);
  monster.run(3, null, "Bakugo", 282, 3, 1);
  monster.run(4, null, "Academy Wolf", 50, 4, 1);
  monster.run(5, null, "Misaka", 77, 5, 1);
  monster.run(6, null, "All Might", 282, 6, 1);
  monster.run(7, null, "Percent Guy", 90, 7, 1);
  monster.run(8, null, "Thousand", 91, 8, 1);
  monster.run(9, null, "AXB Special", 92, 9, 1);
  monster.run(10, null, "Literal", 93, 10, 1);
  monster.run(11, null, "No Group", null, 11, 1);
  monster.run(12, null, "MHA Mat", 282, 12, 15);
  monster.run(13, null, "MHA Transform", 282, 13, 1);
  monster.run(14, null, "U.A. Medal", 603, 14, 1);
  monster.run(15, null, "Ninja", 40, 15, 1);
  db.prepare(`INSERT INTO transformations (to_monster_id) VALUES (?)`).run(13);

  const series = db.prepare(
    `INSERT INTO series (series_id, name_en, series_type) VALUES (?, ?, ?)`
  );
  series.run(1, "My Hero Academia", "collab");
  series.run(2, "Hero Side", "regular");
  series.run(3, "Academy City", "regular");
  series.run(4, "Wild Beasts", "regular");
  series.run(5, "100% Heroes", "collab");
  series.run(6, "1000 Heroes", "collab");
  series.run(7, "A_B Heroes", "collab");
  series.run(8, "AXB Heroes", "regular");
  series.run(9, "Exchange Bucket", "collab");
  series.run(10, "Ninjala", "ghcollab");

  const link = db.prepare(
    `INSERT INTO monster_series (monster_id, series_id, priority) VALUES (?, ?, ?)`
  );
  link.run(1, 1, 5);
  link.run(1, 2, 0);
  link.run(4, 4, 0);
  link.run(5, 3, 0);
  link.run(7, 5, 0);
  link.run(8, 6, 0);
  link.run(9, 8, 0);
  link.run(10, 7, 0);
  link.run(14, 9, 0);
  link.run(14, 1, 1);
  link.run(15, 10, 0);
  return db;
}

function search(
  db: Database.Database,
  query: string,
  groupNameMatch = true,
  minMonsterId = 0
): Hit[] {
  const floorTextMatches = groupNameMatch && minMonsterId > 0;
  const match = buildNameSearchMatchSql(quote, groupNameMatch, floorTextMatches);
  const pattern = escapeLikeContains(query);
  const params: unknown[] = match.joinConsumesPattern ? [pattern] : [];
  params.push(pattern, pattern, pattern);
  if (match.textMatchConsumesMinId) params.push(minMonsterId);
  const select = match.selectSql ? `, ${match.selectSql}` : "";
  const join = match.joinSql ? ` ${match.joinSql}` : "";
  const sql = `SELECT _src.monster_id, _src.name_en${select}
    FROM (
      SELECT monster_id AS __source_pk, monster_id, monster_no_na, name_en, group_id
      FROM monsters
    ) AS _src${join}
    WHERE ${match.whereSql}
    ORDER BY _src.monster_id`;
  return db.prepare(sql).all(...params) as Hit[];
}

function ids(hits: Hit[]): number[] {
  return hits.map((hit) => hit.monster_id);
}

describe("escapeLikeContains", () => {
  it("wraps a plain query and escapes LIKE metacharacters", () => {
    assert.equal(escapeLikeContains("Hero Acad"), "%Hero Acad%");
    assert.equal(escapeLikeContains("100%"), "%100\\%%");
    assert.equal(escapeLikeContains("A_B"), "%A\\_B%");
    assert.equal(escapeLikeContains("a\\b"), "%a\\\\b%");
  });
});

describe("group name search", () => {
  const db = seed();

  it("matches a partial collab title and labels every monster in the group", () => {
    for (const query of ["My Hero Academia", "Hero Acad"]) {
      const hits = search(db, query);
      assert.deepEqual(ids(hits), [1, 3, 6]);
      for (const hit of hits) {
        assert.equal(hit.matched_group_name, "My Hero Academia");
        assert.equal(hit.matched_group_kind, "collab");
      }
    }
  });

  it("also includes other groups and name hits that share the shorter substring", () => {
    const hits = search(db, "Acad");
    assert.deepEqual(ids(hits), [1, 3, 4, 5, 6]);
    const wolf = hits.find((row) => row.monster_id === 4);
    assert.equal(wolf?.matched_group_name, null);
    const misaka = hits.find((row) => row.monster_id === 5);
    assert.equal(misaka?.matched_group_name, "Academy City");
    assert.equal(misaka?.matched_group_kind, "group");
  });

  it("does not include evos, mats, transform forms, or a group titled something else", () => {
    const hits = search(db, "Hero Acad");
    assert.equal(hits.some((row) => row.monster_id === 2), false);
    assert.equal(hits.some((row) => row.monster_id === 12), false);
    assert.equal(hits.some((row) => row.monster_id === 13), false);
    assert.equal(hits.some((row) => row.monster_id === 14), false);
  });

  it("labels a GungHo collab series as Collab", () => {
    const hits = search(db, "Ninjala");
    assert.deepEqual(ids(hits), [15]);
    assert.equal(hits[0]?.matched_group_kind, "collab");
    assert.equal(hits[0]?.matched_group_name, "Ninjala");
  });

  it("prefers the collab title when several series names match", () => {
    const deku = search(db, "Hero").find((row) => row.monster_id === 1);
    assert.equal(deku?.matched_group_name, "My Hero Academia");
    assert.equal(deku?.matched_group_kind, "collab");
  });

  it("includes older group roster cards and still floors name-only hits", () => {
    const hits = search(db, "Acad", true, 5000);
    assert.deepEqual(ids(hits), [1, 3, 5, 6]);
    assert.equal(hits.some((row) => row.monster_id === 4), false);
  });

  it("keeps a name-only hit unlabeled when its group title does not match", () => {
    const hits = search(db, "Deku");
    assert.deepEqual(ids(hits), [1, 2]);
    assert.equal(hits[0]?.matched_group_name, null);
    assert.equal(hits[1]?.matched_group_name, null);
  });

  it("treats % and _ in the query as literal characters", () => {
    assert.deepEqual(ids(search(db, "100%")), [7]);
    assert.equal(search(db, "100%")[0]?.matched_group_name, "100% Heroes");
    assert.deepEqual(ids(search(db, "A_B")), [10]);
    assert.equal(search(db, "A_B")[0]?.matched_group_name, "A_B Heroes");
  });

  it("still matches monster names when group tables are not queried", () => {
    const match = buildNameSearchMatchSql(quote, false);
    assert.equal(match.joinSql, "");
    assert.equal(match.joinConsumesPattern, false);
    const hits = search(db, "Bakugo", false);
    assert.deepEqual(ids(hits), [3]);
    assert.equal(hits[0]?.matched_group_name, undefined);
  });
});

describe("projectSourceRow group label", () => {
  it("keeps the group label when the source whitelist drops other columns", () => {
    const row = projectSourceRow(
      {
        monster_id: 1,
        name_en: "Deku",
        secret_col: "no",
        matched_group_name: "My Hero Academia",
        matched_group_kind: "collab",
      },
      new Set(["monster_id", "name_en"])
    );
    assert.equal(row.matched_group_name, "My Hero Academia");
    assert.equal(row.matched_group_kind, "collab");
    assert.equal(row.secret_col, undefined);
  });
});
