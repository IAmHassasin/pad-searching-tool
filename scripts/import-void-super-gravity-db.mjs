#!/usr/bin/env node
/**
 * Build void-super-gravity supplement SQLite from seed/void-super-gravity-monsters.json.
 *
 * Usage:
 *   node scripts/import-void-super-gravity-db.mjs
 *   node scripts/import-void-super-gravity-db.mjs --out ./seed/void-super-gravity.sqlite
 *
 * Env (optional):
 *   VOID_SUPER_GRAVITY_SQLITE_PATH — output (default seed/void-super-gravity.sqlite)
 *   VOID_SUPER_GRAVITY_MONSTERS_PATH — JSON source (default seed/void-super-gravity-monsters.json)
 *   SQLITE_PATH — dadguide for validation (default seed/dadguide.sqlite)
 */

import Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeMonsterSupplementSqlite } from "./lib/write-monster-supplement-sqlite.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  let out =
    process.env.VOID_SUPER_GRAVITY_SQLITE_PATH?.trim() ||
    resolve(root, "seed/void-super-gravity.sqlite");
  let source =
    process.env.VOID_SUPER_GRAVITY_MONSTERS_PATH?.trim() ||
    resolve(root, "seed/void-super-gravity-monsters.json");
  let dadguide =
    process.env.SQLITE_PATH?.trim() || resolve(root, "seed/dadguide.sqlite");
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) {
      out = resolve(process.cwd(), argv[++i]);
    } else if (argv[i] === "--source" && argv[i + 1]) {
      source = resolve(process.cwd(), argv[++i]);
    } else if (argv[i] === "--dadguide" && argv[i + 1]) {
      dadguide = resolve(process.cwd(), argv[++i]);
    }
  }
  return { out, source, dadguide };
}

function loadMonsterList(sourcePath) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Monster list not found: ${sourcePath}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(sourcePath, "utf8"));
  } catch (err) {
    throw new Error(`Invalid JSON in ${sourcePath}: ${err.message}`);
  }
  if (!Array.isArray(parsed?.monsters) || !parsed.monsters.length) {
    throw new Error(`${sourcePath} must have a non-empty "monsters" array`);
  }
  const rows = [];
  const seen = new Set();
  for (const entry of parsed.monsters) {
    const id = Number(entry?.monster_id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`Invalid monster_id in ${sourcePath}: ${entry?.monster_id}`);
    }
    if (seen.has(id)) {
      throw new Error(`Duplicate monster_id in ${sourcePath}: ${id}`);
    }
    seen.add(id);
    const turns = Number(entry?.turns);
    if (!Number.isInteger(turns) || turns <= 0) {
      throw new Error(
        `Invalid turns for monster_id ${id} in ${sourcePath} (Altema 超重力 duration)`
      );
    }
    rows.push({
      monster_id: id,
      name_en: entry.name_en != null ? String(entry.name_en) : null,
      turns,
      source_url: parsed.sourceUrl != null ? String(parsed.sourceUrl) : null,
    });
  }
  return rows;
}

function validateAgainstDadguide(dadguidePath, rows) {
  if (!existsSync(dadguidePath)) {
    console.warn(
      `Warning: dadguide not found at ${dadguidePath} — skipping monster_id validation`
    );
    return;
  }
  const db = new Database(dadguidePath, { readonly: true });
  try {
    const check = db.prepare(
      `SELECT name_en, name_ja FROM monsters WHERE monster_id = ? LIMIT 1`
    );
    for (const row of rows) {
      const found = check.get(row.monster_id);
      if (!found) {
        throw new Error(
          `monster_id ${row.monster_id} not found in dadguide (${dadguidePath})`
        );
      }
      if (!row.name_en && found.name_en) {
        row.name_en = found.name_en;
      }
      row.name_ja = found.name_ja ?? null;
    }
  } finally {
    db.close();
  }
}

function main() {
  const { out, source, dadguide } = parseArgs(process.argv);
  console.log(`Loading void super gravity list from ${source}…`);
  const rows = loadMonsterList(source);
  console.log(`  ${rows.length} monster(s)`);

  validateAgainstDadguide(dadguide, rows);

  const importedAt = new Date().toISOString();
  writeMonsterSupplementSqlite(out, {
    table: "monster_void_super_gravity",
    columns: [
      { name: "monster_id", type: "INTEGER PRIMARY KEY NOT NULL" },
      { name: "name_en", type: "TEXT" },
      { name: "name_ja", type: "TEXT" },
      { name: "turns", type: "INTEGER NOT NULL" },
      { name: "source_url", type: "TEXT" },
      { name: "imported_at", type: "TEXT NOT NULL" },
    ],
    indexColumns: ["imported_at"],
    rows: rows.map((row) => ({ ...row, imported_at: importedAt })),
  });

  console.log(`Wrote ${rows.length} rows → ${out}`);
}

main();
