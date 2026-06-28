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
