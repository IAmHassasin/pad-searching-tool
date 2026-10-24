/** Hiragana, katakana, CJK unified ideographs, and CJK compatibility ideographs. */
const JAPANESE_SCRIPT = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;

export const NAME_TRANSLATION_BATCH_SIZE = 20;

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
