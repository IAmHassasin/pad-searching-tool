#!/usr/bin/env node
/**
 * Fetch GameWith assist vanish data and write a standalone SQLite file.
 *
 * Awoken names parsed from GameWith are mapped to PST `awoken_skill_id` via:
 *   1. dadguide `awoken_skills.name_ja`
 *   2. manual overrides in seed/vanish-awoken-name-map.json (fill null values)
 *
 * Usage:
 *   node scripts/import-gamewith-vanish-db.mjs
 *   node scripts/import-gamewith-vanish-db.mjs --out ./seed/gamewith-vanish.sqlite
 *
 * Env (optional):
 *   VANISH_AWOKEN_SQLITE_PATH — output path (default seed/gamewith-vanish.sqlite)
 *   SQLITE_PATH — dadguide source for name_ja → awoken_skill_id (default seed/dadguide.sqlite)
 *   VANISH_AWOKEN_NAME_MAP_PATH — manual JP name map (default seed/vanish-awoken-name-map.json)
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const GW_ASSIST_MONSTERS_URL =
  "https://firebasestorage.googleapis.com/v0/b/walkthrough-tool.appspot.com/o/puzzdra%2Fmaster%2FassistMonsters.json?alt=media";
const GW_AWAKENING_SKILLS_URL =
  "https://firebasestorage.googleapis.com/v0/b/walkthrough-tool.appspot.com/o/puzzdra%2Fmaster%2FawakeningSkills.json?alt=media";

const DEFAULT_NAME_MAP = resolve(root, "seed/vanish-awoken-name-map.json");

function parseArgs(argv) {
  let out =
    process.env.VANISH_AWOKEN_SQLITE_PATH?.trim() ||
    resolve(root, "seed/gamewith-vanish.sqlite");
  let dadguide =
    process.env.SQLITE_PATH?.trim() || resolve(root, "seed/dadguide.sqlite");
  let nameMap =
    process.env.VANISH_AWOKEN_NAME_MAP_PATH?.trim() || DEFAULT_NAME_MAP;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) {
      out = resolve(process.cwd(), argv[++i]);
    } else if (argv[i] === "--dadguide" && argv[i + 1]) {
      dadguide = resolve(process.cwd(), argv[++i]);
    } else if (argv[i] === "--name-map" && argv[i + 1]) {
      nameMap = resolve(process.cwd(), argv[++i]);
    }
  }
  return { out, dadguide, nameMap };
}

async function fetchJson(url, label) {
  const res = await fetch(url, {
    headers: { "User-Agent": "pad-searching-tool/1.0" },
  });
  if (!res.ok) {
    throw new Error(`${label} fetch failed: ${res.status} ${res.statusText} (${url})`);
  }
  return res.json();
}

/** Normalize JP awakening names for lookup (+/＋, optional ・, whitespace). */
function normalizeAwokenName(name) {
  return String(name).replace(/\+/g, "＋").replace(/・/g, "").trim();
}

function loadDadguideAwokenByNameJa(dadguidePath) {
  if (!existsSync(dadguidePath)) {
    throw new Error(
      `Dadguide SQLite not found: ${dadguidePath} (set SQLITE_PATH or pass --dadguide)`
    );
  }
  const db = new Database(dadguidePath, { readonly: true });
  try {
    const rows = db
      .prepare(
        `SELECT awoken_skill_id, name_ja FROM awoken_skills
         WHERE name_ja != '' AND name_ja NOT IN ('Untranslated', '???')`
      )
      .all();
    const byName = new Map();
    for (const row of rows) {
      const key = normalizeAwokenName(row.name_ja);
      if (byName.has(key) && byName.get(key) !== row.awoken_skill_id) {
        throw new Error(
          `Duplicate awoken_skills.name_ja after normalize: "${key}"`
        );
      }
      byName.set(key, row.awoken_skill_id);
    }
    return byName;
  } finally {
    db.close();
  }
}
function loadManualNameMap(nameMapPath) {
  if (!existsSync(nameMapPath)) {
    return new Map();
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(nameMapPath, "utf8"));
  } catch (err) {
    throw new Error(`Invalid JSON in ${nameMapPath}: ${err.message}`);
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${nameMapPath} must be a JSON object of name_ja → awoken_skill_id`);
  }
  const byName = new Map();
  for (const [rawKey, rawValue] of Object.entries(parsed)) {
    if (rawKey.startsWith("_")) continue;
    if (rawValue == null || rawValue === "") continue;
    const id = Number(rawValue);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(
        `${nameMapPath}: "${rawKey}" must be a positive integer awoken_skill_id (got ${rawValue})`
      );
    }
    const key = normalizeAwokenName(rawKey);
    byName.set(key, id);
  }
  return byName;
}

function mergeAwokenNameMaps(dadguideMap, manualMap) {
  const merged = new Map(dadguideMap);
  for (const [key, id] of manualMap) {
    merged.set(key, id);
  }
  return merged;
}

function buildAwakeningNamesSorted(gwAwakenings) {
  return gwAwakenings
    .map((a) => a.名前)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function parseGrantedAwokenNames(text, sortedNames) {
  const match = text.match(/([\s\S]*?)を付与/);
  if (!match) return [];
  const segment = match[1].replace(/<br\s*\/?>/gi, "");
  const escaped = sortedNames.map((n) =>
    n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(escaped.join("|"), "g");
  return [...segment.matchAll(regex)].map((m) => m[0]);
}

function mapNamesToPstIds(names, pstByNameJa) {
  const ids = [];
  for (const rawName of names) {
    const name = normalizeAwokenName(rawName);
    const pstId = pstByNameJa.get(name);
    if (pstId == null) {
      throw new Error(
        `No awoken_skill_id mapping for GameWith name: "${rawName}"`
      );
    }
    ids.push(pstId);
  }
  return ids;
}

async function main() {
  const { out, dadguide, nameMap } = parseArgs(process.argv);
  console.log(`Loading dadguide awoken name map from ${dadguide}…`);
  const dadguideMap = loadDadguideAwokenByNameJa(dadguide);
  console.log(`  ${dadguideMap.size} awoken_skills.name_ja entries`);

  const manualMap = loadManualNameMap(nameMap);
  if (existsSync(nameMap)) {
    console.log(`Loading manual name map from ${nameMap}…`);
    console.log(`  ${manualMap.size} manual override(s)`);
  }
  const pstByNameJa = mergeAwokenNameMaps(dadguideMap, manualMap);

  console.log(`Fetching GameWith master data…`);
  const [assistMonsters, gwAwakenings] = await Promise.all([
    fetchJson(GW_ASSIST_MONSTERS_URL, "assistMonsters"),
    fetchJson(GW_AWAKENING_SKILLS_URL, "awakeningSkills"),
  ]);

  if (!Array.isArray(assistMonsters) || !Array.isArray(gwAwakenings)) {
    throw new Error("Unexpected GameWith JSON shape (expected arrays).");
  }

  const sortedNames = buildAwakeningNamesSorted(gwAwakenings);

  const candidates = assistMonsters.filter(
    (m) => m.skillAttributes?.覚醒付与スキル === true && m.図鑑番号 != null
  );

  const rows = [];
  const skipped = [];
  const missingNames = new Set();

  for (const monster of candidates) {
    const skillText = String(monster.スキル内容生成 ?? "");
    const names = parseGrantedAwokenNames(skillText, sortedNames);
    if (!names.length) {
      skipped.push(monster.図鑑番号);
      continue;
    }
    try {
      const ids = mapNamesToPstIds(names, pstByNameJa);
      rows.push({
        monster_id: Number(monster.図鑑番号),
        awoken_skill_ids: JSON.stringify(ids),
        name_ja: monster.正式名称 ?? null,
        skill_text: skillText.replace(/<br\s*\/?>/gi, "\n"),
      });
    } catch (err) {
      const m = err.message.match(/GameWith name: "([^"]+)"/);
      if (m) missingNames.add(m[1]);
      console.warn(`Skip #${monster.図鑑番号}: ${err.message}`);
      skipped.push(monster.図鑑番号);
    }
  }

  if (!rows.length) {
    throw new Error("No vanish-grant rows parsed — GameWith format may have changed.");
  }

  mkdirSync(dirname(out), { recursive: true });
  const db = new Database(out);
  db.pragma("journal_mode = WAL");
  db.exec(`
    DROP TABLE IF EXISTS monster_vanish_awoken;
    CREATE TABLE monster_vanish_awoken (
      monster_id INTEGER PRIMARY KEY NOT NULL,
      awoken_skill_ids TEXT NOT NULL,
      name_ja TEXT,
      skill_text TEXT,
      imported_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX monster_vanish_awoken_imported_idx ON monster_vanish_awoken (imported_at);
  `);

  const insert = db.prepare(`
    INSERT INTO monster_vanish_awoken (monster_id, awoken_skill_ids, name_ja, skill_text)
    VALUES (@monster_id, @awoken_skill_ids, @name_ja, @skill_text)
  `);
  const tx = db.transaction((batch) => {
    for (const row of batch) insert.run(row);
  });
  tx(rows);
  db.close();

  console.log(`Wrote ${rows.length} rows → ${out}`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} assist(s) (unparsed or unmapped awokens).`);
  }
  if (missingNames.size) {
    console.log("Unmapped GameWith awoken names (add to vanish-awoken-name-map.json):");
    for (const name of [...missingNames].sort()) {
      console.log(`  - ${name}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
