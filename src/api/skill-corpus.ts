/**
 * Fuzzy lookup of OCR'd Japanese skill text in the catalog's JP/EN skill pairs. PAD skill
 * text is formulaic, so a new card's skill often equals an existing one apart from numbers;
 * a hit returns the catalog's English wording directly.
 */

export type SkillCorpusKind = "active" | "leader";

export type SkillCorpusEntry = {
  kind: SkillCorpusKind;
  id: number;
  ja: string;
  en: string;
};

export type SkillCorpusMatch = {
  entry: SkillCorpusEntry;
  /** Trigram Jaccard similarity of the normalised texts (0–1). */
  score: number;
};

/** Longest query accepted by the lookup endpoint (the client decides the similarity cut-off). */
export const CORPUS_MAX_QUERY_LENGTH = 400;

/** Lower-case, no whitespace or punctuation, digit runs collapsed to "#". */
export function normalizeJa(text: string): string {
  return text
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .replace(/[\s、。，．,.!！?？:：;；「」『』()（）\[\]【】]/g, "")
    .replace(/\d+(?:\.\d+)?/g, "#");
}

export function trigrams(normalized: string): Set<string> {
  const out = new Set<string>();
  if (normalized.length < 3) {
    if (normalized) out.add(normalized);
    return out;
  }
  for (let i = 0; i + 3 <= normalized.length; i++) out.add(normalized.slice(i, i + 3));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  return inter / (a.size + b.size - inter);
}

export class SkillCorpusIndex {
  private readonly items: Array<{ entry: SkillCorpusEntry; grams: Set<string> }>;

  constructor(entries: SkillCorpusEntry[]) {
    this.items = [];
    for (const entry of entries) {
      if (!entry.ja?.trim() || !entry.en?.trim()) continue;
      this.items.push({ entry, grams: trigrams(normalizeJa(entry.ja)) });
    }
  }

  get size(): number {
    return this.items.length;
  }

  match(query: string, kind?: SkillCorpusKind, topN = 3): SkillCorpusMatch[] {
    const grams = trigrams(normalizeJa(query.slice(0, CORPUS_MAX_QUERY_LENGTH)));
    if (grams.size === 0) return [];
    const best: SkillCorpusMatch[] = [];
    for (const item of this.items) {
      if (kind && item.entry.kind !== kind) continue;
      const score = jaccard(grams, item.grams);
      if (score <= 0) continue;
      if (best.length < topN || score > best[best.length - 1].score) {
        let pos = best.length;
        while (pos > 0 && best[pos - 1].score < score) pos--;
        best.splice(pos, 0, { entry: item.entry, score });
        if (best.length > topN) best.pop();
      }
    }
    return best;
  }
}

const NUMBER = /\d+(?:\.\d+)?/g;

/**
 * Carry the numbers of the OCR'd text into the catalog English when the two Japanese texts
 * differ only in numbers (same count, same order). A number is replaced only when the catalog
 * figure appears exactly once in the English text; `complete` is false when any number could
 * not be carried over.
 */
export function substituteNumbers(
  queryJa: string,
  entryJa: string,
  entryEn: string
): { en: string; substituted: number; complete: boolean } {
  const q = queryJa.match(NUMBER) ?? [];
  const e = entryJa.match(NUMBER) ?? [];
  if (q.length !== e.length) return { en: entryEn, substituted: 0, complete: q.length === 0 && e.length === 0 };
  let en = entryEn;
  let substituted = 0;
  let complete = true;
  for (let i = 0; i < q.length; i++) {
    if (q[i] === e[i]) continue;
    const pattern = new RegExp(`(?<![\\d.,])${e[i].replace(".", "\\.")}(?![\\d.,]*\\d)`, "g");
    const hits = en.match(pattern) ?? [];
    if (hits.length !== 1) {
      complete = false;
      continue;
    }
    en = en.replace(pattern, q[i]);
    substituted++;
  }
  return { en, substituted, complete };
}
