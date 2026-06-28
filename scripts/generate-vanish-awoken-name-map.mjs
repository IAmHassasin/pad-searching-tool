#!/usr/bin/env node
/**
 * Regenerate seed/vanish-awoken-name-map.json with every dadguide awoken whose
 * name_ja is Untranslated. JP keys come from GameWith master (名前) via name_en.
 * Preserves existing non-null values from the current map file.
 *
 * Usage: node scripts/generate-vanish-awoken-name-map.mjs [--write]
 */

import Database from "better-sqlite3";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dadguidePath =
  process.env.SQLITE_PATH?.trim() || resolve(root, "seed/dadguide.sqlite");
const mapPath =
  process.env.VANISH_AWOKEN_NAME_MAP_PATH?.trim() ||
  resolve(root, "seed/vanish-awoken-name-map.json");
const write = process.argv.includes("--write");

const GW_AWAKENING_SKILLS_URL =
  "https://firebasestorage.googleapis.com/v0/b/walkthrough-tool.appspot.com/o/puzzdra%2Fmaster%2FawakeningSkills.json?alt=media";

/** dadguide name_en → GameWith 名前 (untranslated rows only). */
const EN_TO_GW_NAME = {
  "Damage Void Piercer+": "ダメージ無効貫通＋",
  "Cross Attack+": "十字消し攻撃＋",
  "Super Enhanced Combos+": "超コンボ強化＋",
  "3 Att. Enhanced Attack+": "3色攻撃強化＋",
  "4 Att. Enhanced Attack+": "4色攻撃強化＋",
  "5 Att. Enhanced Attack+": "5色攻撃強化＋",
  "Recover Bind+": "バインド回復＋",
  "Triple Enhanced Fire Rows": "火列強化×3",
  "Triple Enhanced Water Rows": "水列強化×3",
  "Triple Enhanced Wood Rows": "木列強化×3",
  "Triple Enhanced Light Rows": "光列強化×3",
  "Triple Enhanced Dark Rows": "闇列強化×3",
  "Enhanced Fire Combos+": "火コンボ強化＋",
  "Enhanced Water Combos+": "水コンボ強化＋",
  "Enhanced Wood Combos+": "木コンボ強化＋",
  "Enhanced Light Combos+": "光コンボ強化＋",
  "Enhanced Dark Combos+": "闇コンボ強化＋",
  "[T] Increased Attack": "T字消し攻撃",
  "All Stat Boost": "全パラメータ強化",
  "Yang Protection": "陽の加護",
  "Yin Protection": "陰の加護",
  Aging: "熟成",
  "Part Break Bonus": "部位破壊ボーナス",
  "Afternoon Tea": "アフタヌーンティー",
  "Fire Water Attack": "火水同時攻撃",
  "Water Wood Attack": "水木同時攻撃",
  "Wood Fire Attack": "木火同時攻撃",
  "Skill Delay Resist": "スキル遅延耐性",
  "Enhanced All Att": "5色ドロップ強化",
  "Assist Resonance": "アシスト共鳴",
  "Self-Reliance": "自力",
  "Move Time Change Resist": "操作時間変更耐性",
  "Expert Multi-Match": "達人多色強化",
};

function loadExistingMap() {
  if (!existsSync(mapPath)) return {};
  return JSON.parse(readFileSync(mapPath, "utf8"));
}

function invertMapById(flat) {
  const byId = new Map();
  for (const [name, id] of Object.entries(flat)) {
    if (name.startsWith("_") || id == null || id === "") continue;
    byId.set(Number(id), { name, id: Number(id) });
  }
  return byId;
}

async function main() {
  const gw = await fetch(GW_AWAKENING_SKILLS_URL, {
    headers: { "User-Agent": "pad-searching-tool/1.0" },
  }).then((r) => r.json());
  const gwNames = new Set(gw.map((a) => a.名前).filter(Boolean));

  const db = new Database(dadguidePath, { readonly: true });
  const untranslated = db
    .prepare(
      `SELECT awoken_skill_id, name_en FROM awoken_skills
       WHERE name_ja = 'Untranslated' ORDER BY awoken_skill_id`
    )
    .all();
  db.close();

  const existing = loadExistingMap();
  const existingById = invertMapById(existing);
  const next = {};
  const unresolved = [];

  for (const row of untranslated) {
    const id = row.awoken_skill_id;
    const kept = existingById.get(id);
    if (kept) {
      next[kept.name] = kept.id;
      continue;
    }

    const gwName = EN_TO_GW_NAME[row.name_en];
    if (!gwName) {
      unresolved.push({ id, name_en: row.name_en, reason: "no EN→GW mapping" });
      next[`__UNMAPPED_${id}__`] = id;
      continue;
    }
    if (!gwNames.has(gwName)) {
      unresolved.push({ id, name_en: row.name_en, gwName, reason: "not in GameWith" });
      next[gwName] = id;
      continue;
    }
    next[gwName] = id;
  }

  // Drop stale keys from old map (not in untranslated set and not dadguide translated)
  const untranslatedIds = new Set(untranslated.map((r) => r.awoken_skill_id));
  for (const [name, value] of Object.entries(existing)) {
    if (name.startsWith("_") || value == null || value === "") continue;
    if (untranslatedIds.has(Number(value)) && !(name in next)) {
      next[name] = value;
    }
  }

  const sorted = Object.fromEntries(
    Object.entries(next).sort(([a], [b]) => a.localeCompare(b, "ja"))
  );

  const filled = Object.values(sorted).filter((v) => v != null).length;
  console.log(`${untranslated.length} untranslated awoken(s) in dadguide`);
  console.log(`${filled} entries with awoken_skill_id`);
  if (unresolved.length) {
    console.log("Unresolved (need manual JP name):");
    for (const u of unresolved) console.log(`  #${u.id} ${u.name_en}`, u);
  }

  const preview = JSON.stringify(sorted, null, 2) + "\n";
  if (write) {
    writeFileSync(mapPath, preview, "utf8");
    console.log(`Wrote ${mapPath}`);
  } else {
    console.log("\nPreview (pass --write to save):");
    console.log(preview);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
