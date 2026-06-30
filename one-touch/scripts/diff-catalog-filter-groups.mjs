#!/usr/bin/env node
/**
 * List awakening IDs in one-touch catalog but missing from AWAKENING_FILTER_GROUPS.
 *
 * Usage: node one-touch/scripts/diff-catalog-filter-groups.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function loadFilterIdsFromSource() {
  const src = readFileSync(
    resolve(root, "web/src/lib/awakening-filter-groups.ts"),
    "utf8"
  );
  const ids = new Set();
  for (const m of src.matchAll(/\b(\d{1,3})\b/g)) {
    const n = Number(m[1]);
    if (n > 0 && n < 500) ids.add(n);
  }
  return ids;
}

const FILTER_IDS = loadFilterIdsFromSource();

const catalog = JSON.parse(
  readFileSync(resolve(root, "web/src/one-touch/catalog.json"), "utf8")
);

const filterIds = FILTER_IDS;
const fromCatalog = new Map();

for (const e of catalog.awakeningEffects) {
  if (e.id != null) fromCatalog.set(e.id, { nameEn: e.nameEn, nameJa: e.nameJa, sources: ["effects"] });
}
for (const d of catalog.dungeons) {
  for (const f of d.floors) {
    for (const a of f.recommendedAwakenings) {
      if (a.id == null) continue;
      const prev = fromCatalog.get(a.id);
      if (prev) {
        if (!prev.sources.includes("floors")) prev.sources.push("floors");
      } else {
        fromCatalog.set(a.id, { nameEn: a.nameEn, nameJa: a.nameJa, sources: ["floors"] });
      }
    }
  }
}

const missing = [...fromCatalog.entries()]
  .filter(([id]) => !filterIds.has(id))
  .sort((a, b) => a[0] - b[0]);

console.log(`Filter groups: ${filterIds.size} unique IDs`);
console.log(`One-touch catalog: ${fromCatalog.size} unique IDs`);
console.log(`Missing from filter groups: ${missing.length}\n`);

console.log("ID\tnameEn\tnameJa\tsources");
for (const [id, info] of missing) {
  console.log(`${id}\t${info.nameEn}\t${info.nameJa}\t${info.sources.join(",")}`);
}
