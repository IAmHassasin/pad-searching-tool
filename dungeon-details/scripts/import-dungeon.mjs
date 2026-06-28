#!/usr/bin/env node
/**
 * Parse AppMedia dungeon guide URL(s) into structured JSON (and optional SQLite).
 *
 * Usage:
 *   node dungeon-details/scripts/import-dungeon.mjs --urls dungeon-details/seed/dungeon-urls.txt
 *   node dungeon-details/scripts/import-dungeon.mjs https://appmedia.jp/pazudora/79970458
 *   node dungeon-details/scripts/import-dungeon.mjs 79970458 79335344 --sqlite dungeon-details/seed/dungeons.sqlite
 *
 * Options:
 *   --urls <file>     Text file with one URL/postId per line (# comments ok)
 *   --master <path>   Gimmick master JSON (default dungeon-details/seed/gimmick-master.json)
 *   --out <path>      Output JSON dir (default dungeon-details/seed/dungeons/<postId>.json)
 *   --sqlite <path>   Also upsert each dungeon into dungeons SQLite table
 *   --refresh-master  Re-merge gimmick panel from each page into master before parsing
 *   --translations <path>  English glossary (default dungeon-details/seed/translations/en.json)
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAppMediaPost, parseAppMediaPostId } from "../lib/appmedia-fetch.mjs";
import {
  DEFAULT_MASTER_PATH,
  loadGimmickMaster,
  mergeGimmickEntries,
  saveGimmickMaster,
} from "../lib/gimmick-master.mjs";
import { parseGimmickPanel } from "../lib/parse-gimmick-panel.mjs";
import { parseDungeonFloorTable } from "../lib/parse-dungeon-table.mjs";
import { writeDungeonSqlite } from "../lib/export-sqlite.mjs";
import {
  DEFAULT_DUNGEON_URLS_PATH,
  readDungeonUrlList,
} from "../lib/read-dungeon-urls.mjs";
import {
  DEFAULT_EN_TRANSLATIONS_PATH,
  loadEnglishTranslations,
  recordTitleTranslation,
  saveEnglishTranslations,
  syncGimmickTranslationsFromMaster,
  translateTitle,
} from "../lib/translate-en.mjs";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT_DIR = join(moduleRoot, "seed/dungeons");

function parseArgs(argv) {
  /** @type {string[]} */
  const targets = [];
  let masterPath = DEFAULT_MASTER_PATH;
  let out = null;
  let sqlite = null;
  let refreshMaster = false;
  let urlsFile = null;
  let translationsPath = DEFAULT_EN_TRANSLATIONS_PATH;

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--master" && argv[i + 1]) {
      masterPath = resolve(process.cwd(), argv[++i]);
    } else if (a === "--out" && argv[i + 1]) {
      out = resolve(process.cwd(), argv[++i]);
    } else if (a === "--sqlite" && argv[i + 1]) {
      sqlite = resolve(process.cwd(), argv[++i]);
    } else if (a === "--urls" && argv[i + 1]) {
      urlsFile = resolve(process.cwd(), argv[++i]);
    } else if (a === "--translations" && argv[i + 1]) {
      translationsPath = resolve(process.cwd(), argv[++i]);
    } else if (a === "--refresh-master") {
      refreshMaster = true;
    } else if (a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}`);
    } else {
      targets.push(a);
    }
  }

  if (urlsFile) {
    targets.push(...readDungeonUrlList(urlsFile));
  }

  if (!targets.length) {
    console.error(
      "Usage: node dungeon-details/scripts/import-dungeon.mjs [--urls file] <url|postId> [...]"
    );
    process.exit(1);
  }

  return { targets, masterPath, out, sqlite, refreshMaster, translationsPath };
}

function summarizeMatchStats(floors) {
  let lines = 0;
  let matched = 0;
  for (const floor of floors) {
    for (const spawn of floor.spawns) {
      for (const effect of spawn.effects) {
        lines += 1;
        if (effect.gimmickIds.length) matched += 1;
      }
    }
  }
  return { lines, matched };
}

/**
 * @param {string} target
 * @param {object} options
 */
async function importOne(target, options) {
  const {
    masterPath,
    out,
    sqlite,
    refreshMaster,
    masterRef,
    translationsRef,
  } = options;
  const postId = parseAppMediaPostId(target);

  console.log(`\nFetching AppMedia post ${postId}…`);
  const post = await fetchAppMediaPost(postId);

  let master = masterRef.current;
  const panelEntries = parseGimmickPanel(post.html);
  if (refreshMaster && panelEntries.length) {
    master = mergeGimmickEntries(master, panelEntries, String(postId));
    saveGimmickMaster(master, masterPath);
    masterRef.current = master;
    console.log(`  Refreshed gimmick master (${master.entries.length} entries)`);
  } else if (!existsSync(masterPath) && panelEntries.length) {
    master = mergeGimmickEntries(master, panelEntries, String(postId));
    saveGimmickMaster(master, masterPath);
    masterRef.current = master;
    console.log(`  Created gimmick master from page (${master.entries.length} entries)`);
  }

  if (
    syncGimmickTranslationsFromMaster(
      translationsRef.current,
      masterRef.current.entries
    )
  ) {
    translationsRef.dirty = true;
  }

  const floors = parseDungeonFloorTable(post.html, master.entries);
  const stats = summarizeMatchStats(floors);

  const requiredGimmicks = panelEntries
    .filter((e) => e.category === "required")
    .map(({ id, labelJa, iconUrl, category }) => ({ id, labelJa, iconUrl, category }));
  const cautionGimmicks = panelEntries
    .filter((e) => e.category === "caution")
    .map(({ id, labelJa, iconUrl, category }) => ({ id, labelJa, iconUrl, category }));

  const glossary = translationsRef.current;
  const titleEn = translateTitle(post.titleJa, glossary, postId);
  if (recordTitleTranslation(glossary, postId, post.titleJa, titleEn)) {
    translationsRef.dirty = true;
  }

  /** @type {import("../lib/import-dungeon-types.mjs").DungeonExport} */
  const dungeon = {
    appmediaPostId: postId,
    titleJa: post.titleJa,
    titleEn,
    sourceUrl: post.sourceUrl,
    modified: post.modified,
    importedAt: new Date().toISOString(),
    requiredGimmicks,
    cautionGimmicks,
    floors,
  };

  const outDir = out ?? DEFAULT_OUT_DIR;
  const jsonPath = outDir.endsWith(".json")
    ? outDir
    : join(outDir, `${postId}.json`);
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(dungeon, null, 2)}\n`, "utf8");

  console.log(`  Title EN: ${titleEn}`);
  console.log(
    `  Floors: ${floors.length}, spawns: ${floors.reduce((n, f) => n + f.spawns.length, 0)}`
  );
  console.log(
    `  Effect match: ${stats.matched}/${stats.lines} (${stats.lines ? Math.round((stats.matched / stats.lines) * 100) : 0}%)`
  );
  console.log(`  Wrote JSON → ${jsonPath}`);

  if (sqlite) {
    writeDungeonSqlite(sqlite, dungeon);
    console.log(`  Upserted SQLite → ${sqlite}`);
  }

  return postId;
}

async function main() {
  const { targets, masterPath, out, sqlite, refreshMaster, translationsPath } =
    parseArgs(process.argv);
  const masterRef = { current: loadGimmickMaster(masterPath) };
  const translationsRef = {
    current: loadEnglishTranslations(translationsPath),
    dirty: false,
  };
  if (
    syncGimmickTranslationsFromMaster(
      translationsRef.current,
      masterRef.current.entries
    )
  ) {
    translationsRef.dirty = true;
  }
  const imported = [];

  for (const target of targets) {
    try {
      const postId = await importOne(target, {
        masterPath,
        out,
        sqlite,
        refreshMaster,
        masterRef,
        translationsRef,
      });
      imported.push(postId);
    } catch (err) {
      console.error(`  Failed ${target}: ${err.message ?? err}`);
    }
  }

  if (translationsRef.dirty) {
    saveEnglishTranslations(translationsRef.current, translationsPath);
    console.log(`Updated translations → ${translationsPath}`);
  }

  console.log(`\nDone: ${imported.length}/${targets.length} dungeon(s) imported.`);
  if (imported.length < targets.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
