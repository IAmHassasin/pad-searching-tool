import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_MASTER_PATH = resolve(root, "seed/gimmick-master.json");
export const DEFAULT_PHRASE_ALIASES_PATH = resolve(root, "seed/gimmick-phrase-aliases.json");

/** @param {string} labelJa */
export function slugifyGimmickId(labelJa) {
  const base = String(labelJa)
    .trim()
    .replace(/×/g, "x")
    .replace(/\//g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9_.x]/gu, "")
    .slice(0, 48);
  if (base) return base;
  return `gimmick_${createHash("sha1").update(labelJa).digest("hex").slice(0, 8)}`;
}

/** @param {string} iconUrl */
function iconKey(iconUrl) {
  const path = iconUrl.replace(/^https?:\/\/appmedia\.jp/i, "");
  return path.split("?")[0].toLowerCase();
}

/**
 * @typedef {Object} GimmickEntry
 * @property {string} id
 * @property {string} labelJa
 * @property {string} iconAlt
 * @property {string} iconUrl
 * @property {"required"|"caution"} category
 * @property {string[]} phrases
 * @property {string[]} sourcePostIds
 */

/**
 * @param {string} [path]
 * @param {string} [aliasesPath]
 * @returns {{ version: number, updatedAt: string, entries: GimmickEntry[] }}
 */
export function loadGimmickMaster(path = DEFAULT_MASTER_PATH, aliasesPath = DEFAULT_PHRASE_ALIASES_PATH) {
  if (!existsSync(path)) {
    return { version: 1, updatedAt: new Date(0).toISOString(), entries: [] };
  }
  const master = JSON.parse(readFileSync(path, "utf8"));
  applyPhraseAliases(master, aliasesPath);
  return master;
}

/**
 * @param {{ entries: GimmickEntry[] }} master
 * @param {string} aliasesPath
 */
function applyPhraseAliases(master, aliasesPath) {
  if (!existsSync(aliasesPath)) return;
  const aliases = JSON.parse(readFileSync(aliasesPath, "utf8"));
  const byLabel = new Map(master.entries.map((e) => [e.labelJa, e]));
  const byId = new Map(master.entries.map((e) => [e.id, e]));

  for (const [key, extraPhrases] of Object.entries(aliases)) {
    const entry = byLabel.get(key) ?? byId.get(key);
    if (!entry || !Array.isArray(extraPhrases)) continue;
    for (const phrase of extraPhrases) {
      const p = String(phrase).trim();
      if (p && !entry.phrases.includes(p)) entry.phrases.push(p);
    }
  }
}

/** @param {ReturnType<typeof loadGimmickMaster>} master @param {string} [path] */
export function saveGimmickMaster(master, path = DEFAULT_MASTER_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(master, null, 2)}\n`, "utf8");
}

/**
 * Merge parsed gimmick rows into master (dedupe by icon URL, then label).
 * @param {ReturnType<typeof loadGimmickMaster>} master
 * @param {Array<Omit<GimmickEntry, "sourcePostIds"> & { sourcePostId?: string }>} incoming
 * @param {string} sourcePostId
 */
export function mergeGimmickEntries(master, incoming, sourcePostId) {
  const byIcon = new Map(master.entries.map((e) => [iconKey(e.iconUrl), e]));
  const byLabel = new Map(master.entries.map((e) => [e.labelJa, e]));

  for (const row of incoming) {
    const key = iconKey(row.iconUrl);
    let existing = byIcon.get(key) ?? byLabel.get(row.labelJa);
    if (!existing) {
      existing = {
        id: row.id || slugifyGimmickId(row.labelJa),
        labelJa: row.labelJa,
        iconAlt: row.iconAlt,
        iconUrl: row.iconUrl,
        category: row.category,
        phrases: [...new Set(row.phrases ?? [row.labelJa, row.iconAlt].filter(Boolean))],
        sourcePostIds: [],
      };
      master.entries.push(existing);
      byIcon.set(key, existing);
      byLabel.set(row.labelJa, existing);
    } else {
      existing.category = row.category;
      if (row.iconAlt && !existing.phrases.includes(row.iconAlt)) {
        existing.phrases.push(row.iconAlt);
      }
      if (row.labelJa && !existing.phrases.includes(row.labelJa)) {
        existing.phrases.push(row.labelJa);
      }
      for (const p of row.phrases ?? []) {
        if (p && !existing.phrases.includes(p)) existing.phrases.push(p);
      }
    }
    if (sourcePostId && !existing.sourcePostIds.includes(sourcePostId)) {
      existing.sourcePostIds.push(sourcePostId);
    }
  }

  master.updatedAt = new Date().toISOString();
  return master;
}

/**
 * Build phrase lookup sorted longest-first for greedy matching.
 * @param {GimmickEntry[]} entries
 */
export function buildPhraseLookup(entries) {
  const phrases = [];
  for (const entry of entries) {
    for (const phrase of entry.phrases) {
      const p = phrase.trim();
      if (!p) continue;
      phrases.push({ phrase: p, entry });
    }
  }
  phrases.sort((a, b) => b.phrase.length - a.phrase.length);
  return phrases;
}

/**
 * Match gimmick ids from a raw effect line using master phrases.
 * @param {string} line
 * @param {ReturnType<typeof buildPhraseLookup>} lookup
 */
export function matchGimmicksInLine(line, lookup) {
  const matched = [];
  const seen = new Set();
  for (const { phrase, entry } of lookup) {
    if (line.includes(phrase) && !seen.has(entry.id)) {
      matched.push(entry.id);
      seen.add(entry.id);
    }
  }
  return matched;
}
