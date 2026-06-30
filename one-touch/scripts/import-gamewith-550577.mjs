#!/usr/bin/env node
/**
 * Parse GameWith article 550577 markdown → one-touch/seed/catalog.json
 *
 * Usage:
 *   node one-touch/scripts/import-gamewith-550577.mjs
 *   node one-touch/scripts/import-gamewith-550577.mjs --input path/to/article.md
 *
 * Env:
 *   SQLITE_PATH — dadguide for awoken_skill_id lookup (default seed/dadguide.sqlite)
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { translateOneTouchEffectEn } from "../lib/translate-effect-en.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const DUNGEONS = [
  { id: "volcano", nameJa: "火山", nameEn: "Volcano", attributeId: 0 },
  { id: "icefield", nameJa: "氷原", nameEn: "Icefield", attributeId: 1 },
  { id: "forest", nameJa: "森林", nameEn: "Forest", attributeId: 2 },
  { id: "ruins", nameJa: "遺跡", nameEn: "Ruins", attributeId: 3 },
  { id: "swamp", nameJa: "沼地", nameEn: "Swamp", attributeId: 4 },
];

const HIDDEN_REWARD_EN = {
  10: {
    condition:
      "5 or more monsters with rarity 5 or below on the team",
    reward: "30,000 MP",
  },
  9: {
    condition: "7 or more monsters with different rarities",
    reward: "30,000 MP",
  },
  8: { condition: "7 or more God-type monsters", reward: "20,000 MP" },
  7: { condition: "7 or more Devil-type monsters", reward: "20,000 MP" },
  6: { condition: "7 or more Dragon-type monsters", reward: "10,000 MP" },
  5: { condition: "7 or more Machine-type monsters", reward: "10,000 MP" },
  4: { condition: "5 or fewer monsters on the team", reward: "10,000 MP" },
  3: null, // per-dungeon attribute
  2: { condition: "Total team cost 150 or below", reward: "10,000 MP" },
  1: { condition: "Total team rarity 20 or below", reward: "10,000 MP" },
};

const ATTR_LABEL_EN = {
  0: "Fire",
  1: "Water",
  2: "Wood",
  3: "Light",
  4: "Dark",
};

const STAMINA_BY_LEVEL = {
  10: { stamina: 100, durationHours: 48 },
  9: { stamina: 90, durationHours: 48 },
  8: { stamina: 80, durationHours: 36 },
  7: { stamina: 70, durationHours: 36 },
  6: { stamina: 60, durationHours: 24 },
  5: { stamina: 50, durationHours: 24 },
  4: { stamina: 40, durationHours: 20 },
  3: { stamina: 30, durationHours: 16 },
  2: { stamina: 20, durationHours: 12 },
  1: { stamina: 10, durationHours: 8 },
};

function normalizeAwokenName(name) {
  return String(name).replace(/\+/g, "＋").replace(/・/g, "").trim();
}

const GW_AWAKENING_SKILLS_URL =
  "https://firebasestorage.googleapis.com/v0/b/walkthrough-tool.appspot.com/o/puzzdra%2Fmaster%2FawakeningSkills.json?alt=media";

const DEFAULT_MANUAL_MAP = resolve(root, "seed/vanish-awoken-name-map.json");
const DEFAULT_ALIASES = resolve(
  root,
  "one-touch/seed/awakening-aliases.json"
);

function loadManualIdMap(path) {
  if (!existsSync(path)) return new Map();
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const out = new Map();
  for (const [name, id] of Object.entries(raw)) {
    if (name.startsWith("_") || id == null) continue;
    out.set(normalizeAwokenName(name), Number(id));
  }
  return out;
}

function loadDadguideAwoken(dadguidePath) {
  const db = new Database(dadguidePath, { readonly: true });
  const rows = db
    .prepare(
      `SELECT awoken_skill_id, name_ja, name_en FROM awoken_skills
       WHERE name_ja != '' AND name_ja NOT IN ('Untranslated', '???')`
    )
    .all();
  db.close();
  const byJa = new Map();
  const byId = new Map();
  for (const row of rows) {
    const key = normalizeAwokenName(row.name_ja);
    byJa.set(key, row);
    byId.set(row.awoken_skill_id, row);
  }
  return { byJa, byId };
}

async function loadGameWithAwokenNames() {
  const res = await fetch(GW_AWAKENING_SKILLS_URL, {
    headers: { "User-Agent": "pad-searching-tool/1.0" },
  });
  if (!res.ok) return new Set();
  const list = await res.json();
  return new Set(list.map((a) => normalizeAwokenName(a.名前)).filter(Boolean));
}

function resolveAwoken(nameJa, lookup) {
  const key = normalizeAwokenName(nameJa);
  let row = lookup.byJa.get(key);
  let id = row?.awoken_skill_id ?? lookup.manualIds.get(key) ?? null;

  if (id == null && !key.endsWith("×3")) {
    const triple = lookup.manualIds.get(`${key}×3`);
    if (triple != null) id = triple;
  }

  if (id != null && !row) row = lookup.byId.get(id);

  const nameEn =
    row?.name_en &&
    row.name_en !== "Untranslated" &&
    row.name_en !== "???"
      ? row.name_en
      : nameJa;
  return { nameJa, nameEn, id };
}

function extractLinks(text) {
  const out = [];
  const re = /\[([^\]]+)\]\([^)]+\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const label = m[1].replace(/^パズドラの/, "").trim();
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

function parseBracketField(text, label) {
  const re = new RegExp(`【${label}】([^【]*)`);
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function parseStaminaTime(text) {
  const raw = parseBracketField(text, "必要スタミナ/時間");
  if (!raw) return { stamina: null, durationHours: null };
  const m = raw.match(/(\d+)\/(\d+)時間/);
  if (!m) return { stamina: null, durationHours: null };
  return { stamina: Number(m[1]), durationHours: Number(m[2]) };
}

function parseRewards(text) {
  const raw = parseBracketField(text, "報酬");
  if (!raw) return null;
  const exp = raw.match(/探索経験値：(\d+)/);
  const coins = raw.match(/コイン：([^プラス]+)/);
  const plus = raw.match(/プラスポイント：([＋+]?)(\d+)/);
  return {
    explorationExp: exp ? Number(exp[1]) : null,
    coins: coins ? coins[1].trim() : null,
    plusPoints: plus ? Number(plus[2]) : null,
  };
}

function parseFloorRow(level, cell, lookup) {
  const staminaTime = parseStaminaTime(cell);
  const fallback = STAMINA_BY_LEVEL[level] ?? { stamina: null, durationHours: null };
  const awkRaw = parseBracketField(cell, "おすすめ覚醒");
  const awkNames = awkRaw ? extractLinks(awkRaw) : [];
  const recommendedAwakenings = awkNames.map((n) => resolveAwoken(n, lookup));

  const dropsRaw = parseBracketField(cell, "ドロップ");
  const dropNames = dropsRaw ? extractLinks(dropsRaw) : [];
  const drops = dropNames.map((nameJa) => {
    const row = lookup.byJa.get(normalizeAwokenName(nameJa));
    const nameEn =
      row?.name_en && row.name_en !== "Untranslated" ? row.name_en : nameJa;
    return { nameJa, nameEn };
  });

  const hiddenRaw = parseBracketField(cell, "隠し報酬・条件");
  let hiddenCondition = null;
  let hiddenReward = "10,000 MP";
  if (hiddenRaw) {
    const condMatch = hiddenRaw.match(/^(.+?)(?:パズドラの|$)/);
    hiddenCondition = condMatch ? condMatch[1].trim() : hiddenRaw;
    if (hiddenRaw.includes("3万MP")) hiddenReward = "30,000 MP";
    else if (hiddenRaw.includes("2万MP")) hiddenReward = "20,000 MP";
    else if (hiddenRaw.includes("1万MP")) hiddenReward = "10,000 MP";
  }

  return {
    level,
    stamina: staminaTime.stamina ?? fallback.stamina,
    durationHours: staminaTime.durationHours ?? fallback.durationHours,
    recommendedAwakenings,
    rewards: parseRewards(cell),
    drops,
    hiddenConditionJa: hiddenCondition,
    hiddenReward,
  };
}

function parseDungeonSection(nameJa, body, lookup) {
  const floors = [];
  const rowRe = /\|\s*Lv(\d+)\s*\|\s*([^|]+)\|/g;
  let m;
  while ((m = rowRe.exec(body)) !== null) {
    floors.push(parseFloorRow(Number(m[1]), m[2], lookup));
  }
  floors.sort((a, b) => b.level - a.level);
  return floors;
}

function parseAwakeningEffects(md, lookup) {
  const start = md.indexOf("### 覚醒スキルの効果一覧");
  if (start < 0) return [];
  const slice = md.slice(start);
  const end = slice.indexOf("\n## ");
  const section = end > 0 ? slice.slice(0, end) : slice;
  const effects = [];
  const rowRe = /\|\s*\[([^\]]+)\][^|]*\|\s*([^|]+)\s*\|/g;
  let m;
  while ((m = rowRe.exec(section)) !== null) {
    const nameJa = m[1].replace(/(.+)\1$/, "$1").trim();
    const effectJa = m[2].trim();
    const awk = resolveAwoken(nameJa, lookup);
    effects.push({
      ...awk,
      effectJa,
      effectEn: translateOneTouchEffectEn(effectJa),
    });
  }
  return effects;
}

function enrichHiddenFloors(dungeon, floors) {
  const attr = ATTR_LABEL_EN[dungeon.attributeId];
  return floors.map((f) => {
    const template = HIDDEN_REWARD_EN[f.level];
    let conditionEn = template?.condition ?? null;
    let reward = template?.reward ?? f.hiddenReward;
    if (f.level === 3) {
      conditionEn = `5 or more ${attr}-attribute monsters on the team`;
    }
    if (f.hiddenConditionJa && !conditionEn) {
      conditionEn = f.hiddenConditionJa;
    }
    return {
      ...f,
      hiddenConditionEn: conditionEn,
      hiddenReward: reward,
    };
  });
}

function parseArgs(argv) {
  let input = resolve(root, "uploads/550577-0.md");
  let out = resolve(root, "one-touch/seed/catalog.json");
  let webOut = resolve(root, "web/src/one-touch/catalog.json");
  let dadguide =
    process.env.SQLITE_PATH?.trim() || resolve(root, "seed/dadguide.sqlite");
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) input = resolve(argv[++i]);
    else if (argv[i] === "--out" && argv[i + 1]) out = resolve(argv[++i]);
    else if (argv[i] === "--dadguide" && argv[i + 1])
      dadguide = resolve(argv[++i]);
  }
  return { input, out, webOut, dadguide };
}

async function main() {
  const { input, out, webOut, dadguide } = parseArgs(process.argv);
  if (!existsSync(input)) {
    throw new Error(`Input markdown not found: ${input}`);
  }
  if (!existsSync(dadguide)) {
    throw new Error(`Dadguide not found: ${dadguide}`);
  }

  const md = readFileSync(input, "utf8");
  const dadguideLookup = loadDadguideAwoken(dadguide);
  const manualIds = loadManualIdMap(DEFAULT_MANUAL_MAP);
  for (const [k, v] of loadManualIdMap(DEFAULT_ALIASES)) {
    if (!manualIds.has(k)) manualIds.set(k, v);
  }
  const lookup = {
    ...dadguideLookup,
    manualIds,
  };
  await loadGameWithAwokenNames();

  const listStart = md.indexOf("## ワンタッチダンジョン一覧とおすすめ覚醒");
  const listEnd = md.indexOf("## ワンタッチダンジョンの覚醒スキル効果");
  const listMd = listStart >= 0 ? md.slice(listStart, listEnd) : md;

  const dungeons = [];
  const unresolvedAwks = new Set();

  for (const def of DUNGEONS) {
    const header = `### ${def.nameJa}`;
    const start = listMd.indexOf(header);
    if (start < 0) {
      console.warn(`Missing section: ${header}`);
      continue;
    }
    const nextHeader = listMd.indexOf("\n### ", start + header.length);
    const body =
      nextHeader > 0 ? listMd.slice(start, nextHeader) : listMd.slice(start);
    const floors = enrichHiddenFloors(def, parseDungeonSection(def.nameJa, body, lookup));
    for (const f of floors) {
      for (const a of f.recommendedAwakenings) {
        if (a.id == null) unresolvedAwks.add(a.nameJa);
      }
    }
    dungeons.push({ ...def, floors });
  }

  const awakeningEffects = parseAwakeningEffects(md, lookup);
  for (const a of awakeningEffects) {
    if (a.id == null) unresolvedAwks.add(a.nameJa);
  }

  const catalog = {
    version: 1,
    sourceUrl:
      "https://xn--0ck4aw2h.gamewith.jp/article/show/550577",
    importedAt: new Date().toISOString().slice(0, 10),
    dungeons,
    awakeningEffects,
  };

  for (const p of [out, webOut]) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(catalog, null, 2) + "\n", "utf8");
    console.log(`Wrote ${p}`);
  }

  if (unresolvedAwks.size) {
    console.warn(`Unresolved awakening names (${unresolvedAwks.size}):`);
    for (const n of [...unresolvedAwks].sort()) console.warn(`  - ${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
