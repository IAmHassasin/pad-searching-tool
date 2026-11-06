/**
 * Japanese → English for the text fields of a new card: catalog lookup first (same skill text
 * as an existing card, numbers carried over), machine translation through the server
 * otherwise, with the PAD glossary applied around it.
 */
import { fetchCorpusMatch, translateLabels, type SkillCorpusMatch } from "../../api";
import { loadAwokenSkillBlurbs } from "../awoken-skill-catalog";
import { monsterTypeLabel } from "../monster-types";
import {
  applyPostTranslationGlossary,
  applyPreTranslationGlossary,
  hasJapanese,
} from "./jp-text.ts";
import type { OcrFields } from "./pipeline.ts";
import type { SkillStages } from "./stages.ts";

/** Catalog similarity at which the catalog wording is used instead of machine translation. */
export const CORPUS_USE_MIN_SCORE = 0.6;
/** Server-side limit per text on the labels endpoint. */
export const MAX_TRANSLATE_CHARS = 300;

export type TextSource = "catalog" | "machine" | "unchanged" | "failed";

export type TranslatedStage = {
  name: string;
  body: string;
  turns: number | null;
  final: boolean;
  sources: { name: TextSource; body: TextSource };
};

export type TranslatedTexts = {
  name: string;
  activeName: string;
  activeDesc: string;
  leaderName: string;
  leaderDesc: string;
  sources: Record<"name" | "activeName" | "activeDesc" | "leaderName" | "leaderDesc", TextSource>;
  corpus: { active: SkillCorpusMatch | null; leader: SkillCorpusMatch | null };
  /** English stages of an evolving skill (same order as the screenshot), when read from a popup. */
  stages: { kind: SkillStages["kind"]; stages: TranslatedStage[] } | null;
  /** Problems worth showing (network errors, incomplete number carry-over). */
  notes: string[];
};

/** Replace "[type:ID]" tokens with the type label ("[Balanced type]"). */
export function resolveTypeTokens(text: string): string {
  return text.replace(/\[type:(\d+)\]/g, (_whole, id: string) => `[${monsterTypeLabel(Number(id))} type]`);
}

/** Replace "[awk:ID]" tokens with the awakening's English name when the catalog knows it, and type tokens. */
export async function resolveAwakeningTokens(text: string): Promise<string> {
  const withTypes = resolveTypeTokens(text);
  if (!/\[awk:\d+\]/.test(withTypes)) return withTypes;
  try {
    const blurbs = await loadAwokenSkillBlurbs();
    return withTypes.replace(/\[awk:(\d+)\]/g, (_whole, id: string) => {
      const name = blurbs.get(Number(id))?.name;
      // Awakenings newer than the catalog have no name yet; keep the id visible for the editor.
      return name ? `[${name}]` : `[awakening #${id}]`;
    });
  } catch {
    return withTypes.replace(/\[awk:(\d+)\]/g, (_whole, id: string) => `[awakening #${id}]`);
  }
}

/** Machine-translate the Japanese entries of `texts` (others pass through); null when the service failed. */
async function machineTranslate(texts: string[], titleCase: boolean): Promise<string[] | null> {
  const pending = texts.map((t) => (hasJapanese(t) ? applyPreTranslationGlossary(t) : t));
  // The endpoint accepts 300 characters per text; longer OCR output is garbage and is kept as is.
  const indices = pending.map((t, i) => (hasJapanese(t) && t.length <= MAX_TRANSLATE_CHARS ? i : -1)).filter((i) => i >= 0);
  if (!indices.length) return texts;
  try {
    const out = [...texts];
    // The endpoint takes at most 10 texts per request.
    for (let offset = 0; offset < indices.length; offset += 10) {
      const chunk = indices.slice(offset, offset + 10);
      const { texts: translated } = await translateLabels(chunk.map((i) => pending[i]), titleCase);
      chunk.forEach((i, k) => {
        const en = translated[k];
        out[i] = en && en !== pending[i] ? (titleCase ? en : applyPostTranslationGlossary(en)) : texts[i];
      });
    }
    return out;
  } catch {
    return null;
  }
}

async function corpusLookup(
  ja: string,
  kind: "active" | "leader",
  notes: string[]
): Promise<SkillCorpusMatch | null> {
  if (!ja.trim()) return null;
  try {
    // The endpoint accepts up to 400 characters; longer OCR text is a parse failure anyway.
    const { matches } = await fetchCorpusMatch(ja.slice(0, 400), kind);
    return matches[0] ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notes.push(`Catalog lookup for the ${kind} skill failed (${message}); machine translation used instead.`);
    return null;
  }
}

function sourceOf(before: string, after: string, failed: boolean): TextSource {
  if (failed) return "failed";
  return after !== before ? "machine" : "unchanged";
}

async function translateStages(stages: SkillStages, notes: string[]): Promise<TranslatedTexts["stages"]> {
  const names = await machineTranslate(
    stages.stages.map((s) => s.name),
    true
  );
  const bodies: string[] = [];
  const bodySources: TextSource[] = [];
  const toMachine: number[] = [];
  for (const [i, stage] of stages.stages.entries()) {
    const match = await corpusLookup(stage.body, "active", notes);
    if (match && match.score >= CORPUS_USE_MIN_SCORE) {
      bodies[i] = match.enWithQueryNumbers ?? match.en;
      bodySources[i] = "catalog";
    } else {
      bodies[i] = stage.body;
      bodySources[i] = "unchanged";
      if (hasJapanese(stage.body)) toMachine.push(i);
    }
  }
  if (toMachine.length) {
    const machine = await machineTranslate(toMachine.map((i) => stages.stages[i].body), false);
    toMachine.forEach((i, k) => {
      if (machine) {
        bodies[i] = machine[k];
        bodySources[i] = sourceOf(stages.stages[i].body, machine[k], false);
      } else {
        bodySources[i] = "failed";
      }
    });
    if (!machine) notes.push("Stage text translation failed (translation service unavailable); Japanese kept.");
  }
  if (!names) notes.push("Stage name translation failed (translation service unavailable); Japanese kept.");
  return {
    kind: stages.kind,
    stages: await Promise.all(
      stages.stages.map(async (stage, i) => ({
        name: names?.[i] ?? stage.name,
        body: await resolveAwakeningTokens(bodies[i]),
        turns: stage.turns,
        final: stage.final,
        sources: { name: sourceOf(stage.name, names?.[i] ?? stage.name, !names), body: bodySources[i] },
      }))
    ),
  };
}

export async function translateCardTexts(ocr: OcrFields, stages: SkillStages | null = null): Promise<TranslatedTexts> {
  const notes: string[] = [];
  const [activeMatch, leaderMatch] = await Promise.all([
    stages ? Promise.resolve(null) : corpusLookup(ocr.activeDesc, "active", notes),
    corpusLookup(ocr.leaderDesc, "leader", notes),
  ]);

  const result: TranslatedTexts = {
    name: ocr.name,
    activeName: ocr.activeName,
    activeDesc: ocr.activeDesc,
    leaderName: ocr.leaderName,
    leaderDesc: ocr.leaderDesc,
    sources: {
      name: "unchanged",
      activeName: "unchanged",
      activeDesc: "unchanged",
      leaderName: "unchanged",
      leaderDesc: "unchanged",
    },
    corpus: { active: activeMatch, leader: leaderMatch },
    stages: null,
    notes,
  };

  const descToMachine: Array<"activeDesc" | "leaderDesc"> = [];
  for (const [field, match] of [
    ["activeDesc", activeMatch],
    ["leaderDesc", leaderMatch],
  ] as const) {
    if (field === "activeDesc" && stages) continue;
    if (match && match.score >= CORPUS_USE_MIN_SCORE) {
      result[field] = match.enWithQueryNumbers ?? match.en;
      result.sources[field] = "catalog";
      if (match.numbersComplete === false) {
        notes.push(`${field === "activeDesc" ? "Skill" : "Leader skill"}: a number differs from the catalog text and could not be carried over; check the English.`);
      }
    } else if (hasJapanese(ocr[field])) {
      descToMachine.push(field);
    }
  }

  const nameInputs = stages ? [ocr.name, ocr.leaderName] : [ocr.name, ocr.activeName, ocr.leaderName];
  const names = await machineTranslate(nameInputs, true);
  if (names) {
    result.name = names[0];
    result.sources.name = sourceOf(ocr.name, names[0], false);
    if (stages) {
      result.leaderName = names[1];
      result.sources.leaderName = sourceOf(ocr.leaderName, names[1], false);
    } else {
      result.activeName = names[1];
      result.leaderName = names[2];
      result.sources.activeName = sourceOf(ocr.activeName, names[1], false);
      result.sources.leaderName = sourceOf(ocr.leaderName, names[2], false);
    }
  } else {
    notes.push("Name translation failed (translation service unavailable); Japanese kept.");
    result.sources.name = result.sources.activeName = result.sources.leaderName = "failed";
  }

  if (descToMachine.length) {
    const machine = await machineTranslate(descToMachine.map((f) => ocr[f]), false);
    descToMachine.forEach((field, i) => {
      if (machine && machine[i] !== ocr[field]) {
        result[field] = machine[i];
        result.sources[field] = "machine";
      } else {
        result.sources[field] = machine ? "unchanged" : "failed";
      }
    });
    if (!machine) notes.push("Skill text translation failed (translation service unavailable); Japanese kept.");
  }

  if (stages) {
    result.stages = await translateStages(stages, notes);
    const first = result.stages?.stages[0];
    if (first) {
      result.activeName = first.name;
      result.activeDesc = first.body;
      result.sources.activeName = first.sources.name;
      result.sources.activeDesc = first.sources.body;
    }
  }

  result.activeDesc = await resolveAwakeningTokens(result.activeDesc);
  result.leaderDesc = await resolveAwakeningTokens(result.leaderDesc);
  return result;
}
