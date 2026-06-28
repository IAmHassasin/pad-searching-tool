import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_EN_TRANSLATIONS_PATH = join(
  moduleRoot,
  "seed/translations/en.json"
);

/** @param {string} [path] */
export function loadEnglishTranslations(path = DEFAULT_EN_TRANSLATIONS_PATH) {
  if (!existsSync(path)) {
    return { titles: {}, gimmicks: {}, phrases: [] };
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

/** @param {unknown} data @param {string} [path] */
export function saveEnglishTranslations(data, path = DEFAULT_EN_TRANSLATIONS_PATH) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** @param {string} titleJa */
export function stripPadTitlePrefix(titleJa) {
  return titleJa.replace(/^【パズドラ】/, "").trim();
}

/**
 * @param {string} titleJa
 * @param {{ titles?: Record<string, string>, phrases?: [string, string][] }} glossary
 * @param {number} [postId]
 */
export function translateTitle(titleJa, glossary, postId) {
  const stripped = stripPadTitlePrefix(titleJa);
  if (postId != null) {
    const byId = glossary.titles?.[String(postId)];
    if (byId) return byId;
  }
  const byExact = glossary.titles?.[stripped] ?? glossary.titles?.[titleJa];
  if (byExact) return byExact;

  let out = stripped;
  const phrases = [...(glossary.phrases ?? [])].sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [ja, en] of phrases) {
    if (out.includes(ja)) out = out.split(ja).join(en);
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Persist title mapping for reuse (mutates glossary).
 * @param {{ titles?: Record<string, string> }} glossary
 * @param {number} postId
 * @param {string} titleJa
 * @param {string} titleEn
 * @returns {boolean} true if glossary.titles changed
 */
export function recordTitleTranslation(glossary, postId, titleJa, titleEn) {
  if (!titleEn || titleEn === titleJa) return false;
  if (!glossary.titles) glossary.titles = {};

  const stripped = stripPadTitlePrefix(titleJa);
  let changed = false;
  const idKey = String(postId);
  if (glossary.titles[idKey] !== titleEn) {
    glossary.titles[idKey] = titleEn;
    changed = true;
  }
  if (glossary.titles[stripped] !== titleEn) {
    glossary.titles[stripped] = titleEn;
    changed = true;
  }
  return changed;
}

/** Built-in EN labels for gimmick-master entries (PAD terms). */
const DEFAULT_GIMMICK_EN = {
  スキル封印: "Skill Bind",
  超根性: "Super Resolve",
  "お邪魔/爆弾": "Hazard / Bomb",
  お邪魔_爆弾: "Hazard / Bomb",
  ロック: "Jammer",
  トゲ: "Spike",
  弱化目覚め: "Weak awakening",
  爆弾: "Bomb",
  Sチャージ: "Skill Charge",
  Sチャジ: "Skill Charge",
  猛毒目覚め: "Mortal Poison awakening",
  バインド: "Bind",
  個別デバフ: "Targeted debuff",
  毒: "Poison",
  "暗闇/超暗闇": "Dark / Super Dark",
  暗闇_超暗闇: "Dark / Super Dark",
  ドロップ弱化: "Orb weaken",
  "6×5マス": "6×5 board",
  "6x5マス": "6×5 board",
  指定色目覚め: "Specified color awakening",
};

/**
 * @param {string} labelJa
 * @param {{ gimmicks?: Record<string, string>, phrases?: [string, string][] }} glossary
 */
export function translateGimmickLabel(labelJa, glossary) {
  if (glossary.gimmicks?.[labelJa]) return glossary.gimmicks[labelJa];
  let out = labelJa;
  const phrases = [...(glossary.phrases ?? [])].sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [ja, en] of phrases) {
    if (out.includes(ja)) out = out.split(ja).join(en);
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Merge gimmick-master entries into glossary.gimmicks (+ phrases for effect lines).
 * @param {{ gimmicks?: Record<string, string>, phrases?: [string, string][] }} glossary
 * @param {{ id: string, labelJa: string, iconAlt?: string, phrases?: string[] }[]} entries
 * @returns {boolean} true if glossary changed
 */
export function syncGimmickTranslationsFromMaster(glossary, entries) {
  if (!glossary.gimmicks) glossary.gimmicks = {};
  let changed = false;

  for (const entry of entries) {
    let labelEn =
      glossary.gimmicks[entry.id] ??
      glossary.gimmicks[entry.labelJa] ??
      DEFAULT_GIMMICK_EN[entry.id] ??
      DEFAULT_GIMMICK_EN[entry.labelJa];

    if (!labelEn) {
      labelEn = translateGimmickLabel(entry.labelJa, glossary);
      if (labelEn === entry.labelJa) {
        labelEn =
          (entry.iconAlt && DEFAULT_GIMMICK_EN[entry.iconAlt]) ?? entry.labelJa;
      }
    }

    for (const key of [entry.id, entry.labelJa]) {
      if (glossary.gimmicks[key] !== labelEn) {
        glossary.gimmicks[key] = labelEn;
        changed = true;
      }
    }

    if (entry.labelJa && labelEn !== entry.labelJa) {
      if (!glossary.phrases) glossary.phrases = [];
      const hasPhrase = glossary.phrases.some(([ja]) => ja === entry.labelJa);
      if (!hasPhrase) {
        glossary.phrases.push([entry.labelJa, labelEn]);
        changed = true;
      }
    }
  }

  return changed;
}
