#!/usr/bin/env node
/**
 * Regenerate web/src/lib/vanish-filter-groups.ts from gamewith-vanish.sqlite,
 * preserving row order from AWAKENING_FILTER_GROUPS where possible.
 *
 * Usage: node scripts/generate-vanish-filter-groups.mjs [--write]
 */

import Database from "better-sqlite3";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");

const vanishDbPath =
  process.env.VANISH_AWOKEN_SQLITE_PATH?.trim() ||
  resolve(root, "seed/gamewith-vanish.sqlite");
const filterGroupsPath = resolve(
  root,
  "web/src/lib/awakening-filter-groups.ts"
);
const outPath = resolve(root, "web/src/lib/vanish-filter-groups.ts");

function loadVanishIds(dbPath) {
  if (!existsSync(dbPath)) {
    throw new Error(`Vanish DB not found: ${dbPath}`);
  }
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db
      .prepare(
        `SELECT awoken_skill_ids FROM monster_vanish_awoken
         WHERE awoken_skill_ids IS NOT NULL AND awoken_skill_ids != '[]'`
      )
      .all();
    const ids = new Set();
    for (const row of rows) {
      for (const id of JSON.parse(row.awoken_skill_ids)) ids.add(id);
    }
    return ids;
  } finally {
    db.close();
  }
}

/** Parse AWAKENING_FILTER_GROUPS rows from the TS source (no runtime import). */
function loadFilterGroupsFromSource(srcPath) {
  const src = readFileSync(srcPath, "utf8");
  const exportMatch = src.match(
    /export const AWAKENING_FILTER_GROUPS[\s\S]*?= (\[[\s\S]*?\n\]);/
  );
  if (!exportMatch) {
    throw new Error(`Could not parse AWAKENING_FILTER_GROUPS from ${srcPath}`);
  }
  return Function(`"use strict"; return (${exportMatch[1]});`)();
}

function filterGroupsForVanish(groups, vanishIds) {
  return groups
    .map((group) => ({
      label: group.label,
      rows: group.rows
        .map((row) => row.filter((id) => vanishIds.has(id)))
        .filter((row) => row.length > 0),
    }))
    .filter((group) => group.rows.length > 0);
}

function formatGroupsTs(groups) {
  const body = groups
    .map((group) => {
      const rows = group.rows
        .map((row) => `      [${row.join(", ")}],`)
        .join("\n");
      return `  {\n    label: ${JSON.stringify(group.label)},\n    rows: [\n${rows}\n    ],\n  }`;
    })
    .join(",\n");

  return `/** Awakening ids granted on assist vanish (from gamewith-vanish.sqlite). */
import type { AwakeningFilterGroup } from "./awakening-filter-groups";

export const VANISH_FILTER_GROUPS: AwakeningFilterGroup[] = [
${body}
];

export function listVanishFilterableAwakeningIds(): number[] {
  const ids: number[] = [];
  for (const group of VANISH_FILTER_GROUPS) {
    for (const row of group.rows) {
      for (const id of row) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
  }
  return ids;
}
`;
}

const vanishIds = loadVanishIds(vanishDbPath);
const baseGroups = loadFilterGroupsFromSource(filterGroupsPath);
const filtered = filterGroupsForVanish(baseGroups, vanishIds);

const listed = new Set();
for (const group of filtered) {
  for (const row of group.rows) {
    for (const id of row) listed.add(id);
  }
}

const missing = [...vanishIds].filter((id) => !listed.has(id)).sort((a, b) => a - b);
const output = formatGroupsTs(filtered);

console.log(`Vanish DB: ${vanishIds.size} unique awakening ids`);
console.log(`Filter groups: ${filtered.length} groups, ${listed.size} ids listed`);
if (missing.length) {
  console.log(`Not placed in any group (add manually): ${missing.join(", ")}`);
}

if (write) {
  writeFileSync(outPath, output, "utf8");
  console.log(`Wrote ${outPath}`);
} else {
  console.log("\n--- preview ---\n");
  console.log(output);
  console.log("\n(dry run — pass --write to save)");
}
