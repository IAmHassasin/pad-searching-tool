#!/usr/bin/env node
/**
 * Repair glued floor labels ("B12" / "12体出現" = B1 with 2 spawns) left by older
 * importer versions, then recompute `maxDamage` and `floorSummary` for every seed JSON
 * already on disk (no network).
 *
 * Usage:
 *   node dungeon-details/scripts/backfill-floor-summary.mjs [--dir <seedDir>] [--sqlite <db>]
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeDungeonSqlite } from "../lib/export-sqlite.mjs";
import { repairGluedFloorLabels, summarizeFloors } from "../lib/floor-summary.mjs";
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
  let repairedTotal = 0;
  for (const name of files) {
    const filePath = join(dir, name);
    const dungeon = JSON.parse(readFileSync(filePath, "utf8"));
    const { floors, repaired } = repairGluedFloorLabels(dungeon.floors ?? []);
    repairedTotal += repaired;
    const maxDamage = findMaxDamage(floors, (token, raw) =>
      console.warn(`  ${name}: skipped malformed damage "${token}" in "${raw}" — check the source page`)
    );
    const floorSummary = summarizeFloors(floors);
    // Keep header fields ahead of the big arrays.
    const {
      requiredGimmicks,
      cautionGimmicks,
      floors: _oldFloors,
      maxDamage: _oldMax,
      floorSummary: _oldSummary,
      ...head
    } = dungeon;
    const next = { ...head, maxDamage, floorSummary, requiredGimmicks, cautionGimmicks, floors };
    if (JSON.stringify(next) === JSON.stringify(dungeon)) {
      console.log(`${name}: unchanged`);
      continue;
    }
    changed += 1;
    const parts = floorSummary.filter((f) => f.partCount).map((f) => `${f.label}:${f.partCount}`);
    console.log(
      `${name}: ${repaired ? `${repaired} label(s) repaired, ` : ""}max ${maxDamage ? `${maxDamage.value.toLocaleString("en-US")} (${maxDamage.floor ?? "?"})` : "none"}${parts.length ? `, parts ${parts.join(" ")}` : ""}`
    );
    writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    if (sqlite) writeDungeonSqlite(sqlite, next);
  }
  console.log(`Done: ${files.length} seed(s), ${changed} changed, ${repairedTotal} floor label(s) repaired.`);
}

main();
