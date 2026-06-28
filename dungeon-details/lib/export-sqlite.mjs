import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * @param {string} dbPath
 * @param {import("./import-dungeon-types.mjs").DungeonExport} dungeon
 */
export function writeDungeonSqlite(dbPath, dungeon) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS dungeons (
      appmedia_post_id INTEGER PRIMARY KEY,
      title_ja TEXT NOT NULL,
      source_url TEXT NOT NULL,
      modified TEXT,
      imported_at TEXT NOT NULL,
      json TEXT NOT NULL
    );
  `);

  db.prepare(
    `INSERT INTO dungeons (appmedia_post_id, title_ja, source_url, modified, imported_at, json)
     VALUES (@appmediaPostId, @titleJa, @sourceUrl, @modified, @importedAt, @json)
     ON CONFLICT(appmedia_post_id) DO UPDATE SET
       title_ja = excluded.title_ja,
       source_url = excluded.source_url,
       modified = excluded.modified,
       imported_at = excluded.imported_at,
       json = excluded.json`
  ).run({
    appmediaPostId: dungeon.appmediaPostId,
    titleJa: dungeon.titleJa,
    sourceUrl: dungeon.sourceUrl,
    modified: dungeon.modified ?? null,
    importedAt: dungeon.importedAt,
    json: JSON.stringify(dungeon),
  });

  db.close();
}

/**
 * @param {string} dbPath
 * @param {import("./gimmick-master.mjs").GimmickEntry[]} entries
 * @param {string} updatedAt
 */
export function writeGimmickMasterSqlite(dbPath, entries, updatedAt) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS gimmick_master (
      id TEXT PRIMARY KEY,
      label_ja TEXT NOT NULL,
      icon_alt TEXT,
      icon_url TEXT NOT NULL,
      category TEXT NOT NULL,
      phrases_json TEXT NOT NULL,
      source_post_ids_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gimmick_master_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const insert = db.prepare(
    `INSERT INTO gimmick_master (id, label_ja, icon_alt, icon_url, category, phrases_json, source_post_ids_json)
     VALUES (@id, @labelJa, @iconAlt, @iconUrl, @category, @phrasesJson, @sourcePostIdsJson)
     ON CONFLICT(id) DO UPDATE SET
       label_ja = excluded.label_ja,
       icon_alt = excluded.icon_alt,
       icon_url = excluded.icon_url,
       category = excluded.category,
       phrases_json = excluded.phrases_json,
       source_post_ids_json = excluded.source_post_ids_json`
  );

  const tx = db.transaction(() => {
    for (const e of entries) {
      insert.run({
        id: e.id,
        labelJa: e.labelJa,
        iconAlt: e.iconAlt,
        iconUrl: e.iconUrl,
        category: e.category,
        phrasesJson: JSON.stringify(e.phrases),
        sourcePostIdsJson: JSON.stringify(e.sourcePostIds ?? []),
      });
    }
    db.prepare(
      `INSERT INTO gimmick_master_meta (key, value) VALUES ('updatedAt', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(updatedAt);
  });
  tx();
  db.close();
}
