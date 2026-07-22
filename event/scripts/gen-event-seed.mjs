#!/usr/bin/env node
/**
 * Scaffold an event seed JSON from a small config.
 *
 * Usage:
 *   node event/scripts/gen-event-seed.mjs event/scripts/examples/gintama-collab-returns-2606.config.json
 *
 * Writes to event/seed/events/<eventId>.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

const configPath = process.argv[2];
if (!configPath) {
  console.error("Usage: node event/scripts/gen-event-seed.mjs <config.json>");
  process.exit(1);
}

const cfg = JSON.parse(readFileSync(resolve(configPath), "utf8"));
const eventId = cfg.eventId;
if (!eventId || !Array.isArray(cfg.entries)) {
  console.error("Config needs eventId + entries[]");
  process.exit(1);
}

const seed = {
  eventId,
  title: cfg.title ?? eventId,
  subtitle: cfg.subtitle ?? null,
  publishedAt: cfg.publishedAt ?? null,
  sourceUrl: cfg.sourceUrl ?? null,
  coverMonsterIds: cfg.coverMonsterIds ?? [],
  entries: cfg.entries.map((e) => {
    const out = {
      monsterId: e.monsterId,
      role: e.role ?? "new-monster",
      label: e.label ?? null,
    };
    if (e.note) out.note = e.note;
    return out;
  }),
};

const outDir = join(root, "event/seed/events");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${eventId}.json`);
writeFileSync(outPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
console.log(`Wrote ${outPath}`);
console.log(`Page: /event/${eventId}`);
