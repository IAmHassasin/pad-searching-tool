import type { EnglishGlossary } from "./api";

let sortedPhrases: [string, string][] | null = null;

function phraseList(glossary: EnglishGlossary): [string, string][] {
  if (!sortedPhrases) {
    sortedPhrases = [...glossary.phrases].sort(
      (a, b) => b[0].length - a[0].length
    );
  }
  return sortedPhrases;
}

export function resetPhraseCache() {
  sortedPhrases = null;
}

export function translateGimmick(
  id: string,
  labelJa: string,
  glossary: EnglishGlossary
): string {
  return glossary.gimmicks[id] ?? glossary.gimmicks[labelJa] ?? labelJa;
}

export function translateType(typeJa: string, glossary: EnglishGlossary): string {
  return glossary.types[typeJa] ?? typeJa.replace(/タイプ$/, "");
}

export function translateSpawnNote(note: string, glossary: EnglishGlossary): string {
  return glossary.spawnNotes[note] ?? note;
}

export function translatePartLabel(label: string, glossary: EnglishGlossary): string {
  return glossary.partLabels[label] ?? label;
}

export function translateTag(tag: string, glossary: EnglishGlossary): string {
  return glossary.tags[tag] ?? translateLine(tag, glossary);
}

/** Glossary-based substitution (PAD terms). Falls back to Japanese. */
export function translateLine(text: string, glossary: EnglishGlossary): string {
  let out = text;
  for (const [ja, en] of phraseList(glossary)) {
    if (out.includes(ja)) {
      out = out.split(ja).join(en);
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Prefer API titleEn, then glossary titles, then phrase substitution. */
export function translateTitle(
  titleJa: string,
  glossary: EnglishGlossary,
  postId?: number
): string {
  const stripped = titleJa.replace(/^【パズドラ】/, "").trim();
  if (postId != null && glossary.titles?.[String(postId)]) {
    return glossary.titles[String(postId)];
  }
  if (glossary.titles?.[stripped]) return glossary.titles[stripped];
  if (glossary.titles?.[titleJa]) return glossary.titles[titleJa];
  return translateLine(stripped, glossary);
}
