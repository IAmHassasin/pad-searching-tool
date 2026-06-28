#!/usr/bin/env node
/**
 * Build / merge gimmick master data from one or more AppMedia dungeon guide URLs.
 *
 * Usage:
 *   node dungeon-details/scripts/build-gimmick-master.mjs --urls dungeon-details/seed/dungeon-urls.txt
 *   node dungeon-details/scripts/build-gimmick-master.mjs <url|postId> [...]
 *
 * Options:
 *   --out <path>     Output JSON (default dungeon-details/seed/gimmick-master.json)
 *   --sqlite <path>  Also write gimmick_master tables to SQLite
 *   --urls <file>    Text file with one URL/postId per line (# comments ok)
 */

import { resolve } from "node:path";
import { fetchAppMediaPost, parseAppMediaPostId } from "../lib/appmedia-fetch.mjs";
import {
  DEFAULT_MASTER_PATH,
  loadGimmickMaster,
  mergeGimmickEntries,
  saveGimmickMaster,
} from "../lib/gimmick-master.mjs";
import { parseGimmickPanel } from "../lib/parse-gimmick-panel.mjs";
import { writeGimmickMasterSqlite } from "../lib/export-sqlite.mjs";
import { readDungeonUrlList } from "../lib/read-dungeon-urls.mjs";

function parseArgs(argv) {
  /** @type {string[]} */
  const targets = [];
  let out = DEFAULT_MASTER_PATH;
  let sqlite = null;
  let urlsFile = null;

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" && argv[i + 1]) {
      out = resolve(process.cwd(), argv[++i]);
    } else if (a === "--sqlite" && argv[i + 1]) {
      sqlite = resolve(process.cwd(), argv[++i]);
    } else if (a === "--urls" && argv[i + 1]) {
      urlsFile = resolve(process.cwd(), argv[++i]);
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
      `Usage: node dungeon-details/scripts/build-gimmick-master.mjs [--urls file] <url|postId> [...]`
    );
    process.exit(1);
  }

  return { targets, out, sqlite };
}

async function main() {
  const { targets, out, sqlite } = parseArgs(process.argv);
  let master = loadGimmickMaster(out);

  for (const target of targets) {
    const postId = parseAppMediaPostId(target);
    console.log(`Fetching gimmick panel from post ${postId}…`);
    const post = await fetchAppMediaPost(postId);
    const entries = parseGimmickPanel(post.html);
    if (!entries.length) {
      console.warn(`  No 対策しておきたいギミック table on post ${postId}`);
      continue;
    }
    console.log(`  Parsed ${entries.length} gimmick entries`);
    master = mergeGimmickEntries(master, entries, String(postId));
  }

  saveGimmickMaster(master, out);
  console.log(`Wrote ${master.entries.length} master entries → ${out}`);

  if (sqlite) {
    writeGimmickMasterSqlite(sqlite, master.entries, master.updatedAt);
    console.log(`Wrote SQLite → ${sqlite}`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
