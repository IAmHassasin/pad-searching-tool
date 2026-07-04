/**
 * Write a minimal supplement SQLite DB: one table keyed by monster_id.
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * @param {string} outPath
 * @param {{
 *   table: string;
 *   columns: { name: string; type: string }[];
 *   rows: Record<string, unknown>[];
 *   indexColumns?: string[];
 * }} spec
 */
export function writeMonsterSupplementSqlite(outPath, spec) {
  mkdirSync(dirname(outPath), { recursive: true });
  const db = new Database(outPath);
  db.pragma("journal_mode = WAL");

  const colDefs = spec.columns
    .map((c) => `${c.name} ${c.type}`)
    .join(",\n      ");
  const colNames = spec.columns.map((c) => c.name).join(", ");
  const placeholders = spec.columns.map((c) => `@${c.name}`).join(", ");

  db.exec(`
    DROP TABLE IF EXISTS ${spec.table};
    CREATE TABLE ${spec.table} (
      ${colDefs}
    );
  `);

  for (const col of spec.indexColumns ?? []) {
    db.exec(
      `CREATE INDEX IF NOT EXISTS ${spec.table}_${col}_idx ON ${spec.table} (${col});`
    );
  }

  const insert = db.prepare(
    `INSERT INTO ${spec.table} (${colNames}) VALUES (${placeholders})`
  );
  const tx = db.transaction((batch) => {
    for (const row of batch) insert.run(row);
  });
  tx(spec.rows);
  db.close();
}
