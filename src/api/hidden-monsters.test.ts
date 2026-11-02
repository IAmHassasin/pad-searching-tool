import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Database from "better-sqlite3";
import { HIDDEN_MONSTER_IDS, hiddenMonstersClause } from "./hidden-monsters.ts";

describe("hiddenMonstersClause", () => {
  it("hides the broken CLAIRE row (56981)", () => {
    assert.ok(HIDDEN_MONSTER_IDS.includes(56981));
  });

  it("excludes hidden ids and keeps the rest", () => {
    const db = new Database(":memory:");
    db.exec("CREATE TABLE monsters (monster_id INTEGER)");
    const insert = db.prepare("INSERT INTO monsters VALUES (?)");
    for (const id of [56980, 56981, 56982]) insert.run(id);

    const params: unknown[] = [];
    const clause = hiddenMonstersClause(
      'CAST(_src."monster_id" AS INTEGER)',
      params
    );
    assert.ok(clause);
    const rows = db
      .prepare(`SELECT monster_id FROM monsters AS _src WHERE ${clause} ORDER BY monster_id`)
      .all(...params) as { monster_id: number }[];
    assert.deepEqual(
      rows.map((r) => r.monster_id),
      [56980, 56982]
    );
    db.close();
  });
});
