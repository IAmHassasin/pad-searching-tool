#!/usr/bin/env node
/**
 * Recompute `maxDamage` for every seed JSON already on disk (no network).
 * Use after changing dungeon-details/lib/max-damage.mjs or for seeds imported
 * before the field existed.
 *
 * Usage:
 *   node dungeon-details/scripts/backfill-max-damage.mjs [--dir <seedDir>] [--sqlite <db>]
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeDungeonSqlite } from "../lib/export-sqlite.mjs";
import { findMaxDamage } from "../lib/max-damage.mjs";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DIR = join(moduleRoot, "seed/dungeons");

function parseArgs(argv) {
  let dir = DEFAULT_DIR;
  let sqlite = null;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir" && argv[i + 1]) dir = resolve(process.cwd(), argv[++i]);
    else if (a === "--sqlite" && argv[i + 1]) sqlite = resolve(process.cwd(), argv[++i]);
    else throw new Error(`Unknown option: ${a}`);
  }
  return { dir, sqlite };
}

function main() {
  const { dir, sqlite } = parseArgs(process.argv);
  const files = readdirSync(dir).filter((name) => /^\d+\.json$/.test(name));
  let changed = 0;
  for (const name of files) {
    const filePath = join(dir, name);
    const dungeon = JSON.parse(readFileSync(filePath, "utf8"));
    const maxDamage = findMaxDamage(dungeon.floors, (token, raw) =>
      console.warn(`  ${name}: skipped malformed damage "${token}" in "${raw}" — check the source page`)
    );
    const unchanged =
      "maxDamage" in dungeon &&
      JSON.stringify(dungeon.maxDamage ?? null) === JSON.stringify(maxDamage);
    console.log(
      `${name}: ${maxDamage ? `${maxDamage.value.toLocaleString("en-US")} (${maxDamage.floor ?? "?"})` : "none"}${unchanged ? " (unchanged)" : ""}`
    );
    if (unchanged) continue;
    changed += 1;
    // Keep the field next to the other header data, ahead of the big arrays.
    const { requiredGimmicks, cautionGimmicks, floors, maxDamage: _previous, ...head } = dungeon;
    const next = { ...head, maxDamage, requiredGimmicks, cautionGimmicks, floors };
    writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    if (sqlite) writeDungeonSqlite(sqlite, next);
  }
  console.log(`Done: ${files.length} seed(s), ${changed} changed.`);
}

main();
