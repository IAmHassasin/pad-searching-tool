/** Hiragana, katakana, CJK unified ideographs, and CJK compatibility ideographs. */
const JAPANESE_SCRIPT = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;

export const NAME_TRANSLATION_BATCH_SIZE = 20;

const SMALL_TITLE_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "on",
  "for",
  "to",
  "vs",
]);

/**
 * Capitalize a translated label without disturbing words that already use
 * capitals (PAD, BLEACH, IDOLM@STER) or leading numbers (14th).
 */
export function titleCaseTranslatedName(text: string): string {
  const parts = text.split(/(\s+)/);
  const wordIndexes = parts.flatMap((part, index) => (part.trim() ? [index] : []));
  const last = wordIndexes.length - 1;
  return parts
    .map((part, index) => {
      const order = wordIndexes.indexOf(index);
      if (order < 0) return part;
      return capitalizeTranslatedWord(part, order === 0 || order === last);
    })
    .join("");
}

function capitalizeTranslatedWord(word: string, isEdge: boolean): string {
  if (/^\d/.test(word)) return word;
  const letters = word.replace(/[^A-Za-z\u00C0-\u024F]/g, "");
  if (!letters) return word;
  if (/[A-Z\u00C0-\u00D6\u00D8-\u00DE]/.test(word)) return word;
  if (!isEdge && SMALL_TITLE_WORDS.has(letters.toLowerCase())) return word;
  return word.replace(/[A-Za-z\u00C0-\u024F]/, (character) => character.toUpperCase());
}

export type MonsterNameSource = {
  monsterId: number;
  nameEn: string | null;
  nameJp: string | null;
};

export type CachedMonsterName = {
  source: string;
  english: string;
};

export function containsJapanese(text: string): boolean {
  return JAPANESE_SCRIPT.test(text);
}

/**
 * Japanese string to send to the translator.
 * An existing Latin `name_en` is kept and is not replaced by a translation of `name_jp`.
 */
export function japaneseSourceName(row: MonsterNameSource): string | null {
  const en = row.nameEn?.trim() ?? "";
  const jp = row.nameJp?.trim() ?? "";
  if (en && containsJapanese(en)) return en;
  if (!en && jp && containsJapanese(jp)) return jp;
  return null;
}

export function passthroughMonsterName(row: MonsterNameSource): string {
  const en = row.nameEn?.trim() ?? "";
  if (en) return en;
  return row.nameJp?.trim() ?? "";
}

export async function translateMonsterNameRows(
  rows: MonsterNameSource[],
  cache: Map<number, CachedMonsterName>,
  translateBatch: (texts: string[]) => Promise<string[]>,
  batchSize = NAME_TRANSLATION_BATCH_SIZE
): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  const pending: { monsterId: number; source: string }[] = [];

  for (const row of rows) {
    const source = japaneseSourceName(row);
    if (!source) {
      const plain = passthroughMonsterName(row);
      if (plain) names[String(row.monsterId)] = plain;
      continue;
    }
    const cached = cache.get(row.monsterId);
    if (cached && cached.source === source) {
      names[String(row.monsterId)] = cached.english;
      continue;
    }
    pending.push({ monsterId: row.monsterId, source });
  }

  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const chunk = pending.slice(offset, offset + batchSize);
    let translated: string[] | null = null;
    try {
      translated = await translateBatch(chunk.map((item) => item.source));
    } catch {
      translated = null;
    }
    chunk.forEach((item, index) => {
      const raw = translated?.[index]?.trim();
      const english = raw || item.source;
      if (translated) {
        cache.set(item.monsterId, { source: item.source, english });
      }
      names[String(item.monsterId)] = english;
    });
  }

  return names;
}

/**
 * Translate labels that still contain Japanese. Latin text is returned unchanged.
 * Uses the same batch translator and failure behavior as monster names.
 */
export async function translateJapaneseLabels(
  labels: string[],
  cache: Map<string, string>,
  translateBatch: (texts: string[]) => Promise<string[]>,
  batchSize = NAME_TRANSLATION_BATCH_SIZE
): Promise<string[]> {
  const pending: string[] = [];
  const queued = new Set<string>();

  for (const label of labels) {
    const source = label.trim();
    if (!source || !containsJapanese(source) || cache.has(source) || queued.has(source)) {
      continue;
    }
    queued.add(source);
    pending.push(source);
  }

  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const chunk = pending.slice(offset, offset + batchSize);
    let translated: string[] | null = null;
    try {
      translated = await translateBatch(chunk);
    } catch {
      translated = null;
    }
    chunk.forEach((source, index) => {
      const raw = translated?.[index]?.trim();
      const english = raw ? titleCaseTranslatedName(raw) : source;
      if (translated) cache.set(source, english);
    });
  }

  return labels.map((label) => {
    const source = label.trim();
    if (!source || !containsJapanese(source)) return label;
    return cache.get(source) ?? label;
  });
}
