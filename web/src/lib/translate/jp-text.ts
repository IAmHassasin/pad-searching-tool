/**
 * Clean-up of OCR'd Japanese skill text and the small PAD glossary applied around machine
 * translation. The rules come from errors observed on real screenshots (see the plan); they
 * are heuristics, and the review UI always shows the source text for correction.
 */

const FULLWIDTH_OFFSET = 0xfee0;

/** Full-width ASCII (digits, letters, punctuation) → half-width. */
export function toHalfWidth(text: string): string {
  return text.replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - FULLWIDTH_OFFSET));
}

/** Letters tesseract confuses with digits inside a number. */
const DIGIT_LOOKALIKES: Record<string, string> = {
  O: "0",
  o: "0",
  D: "0",
  U: "0",
  B: "8",
  Z: "2",
  S: "5",
  l: "1",
  I: "1",
  i: "1",
  "|": "1",
  q: "9",
};

const LOOKALIKE_RUN = /[0-9OoDUBZSlIi|q]{2,}(?=[万億%倍個体ターン秒回コ]|$)/g;

function fixDigitRun(run: string): string {
  if (!/[0-9]/.test(run)) return run;
  return run.replace(/[OoDUBZSlIi|q]/g, (ch) => DIGIT_LOOKALIKES[ch] ?? ch);
}

/** Known misreads of common PAD words. */
const WORD_FIXES: Array<[RegExp, string]> = [
  [/のの/g, "の"],
  [/落ちち/g, "落ち"],
  [/人の/g, "の"],
  [/ター[:：]/g, "ターン:"],
  [/ター[ソツニ]ン?/g, "ターン"],
  [/ターン[ソツニ]ン?/g, "ターン"],
  [/ターンン/g, "ターン"],
  [/段階[日目]/g, "段階目"],
  [/[騰箕]階目/g, "段階目"],
  [/軽滞/g, "軽減"],
  [/[還国]定/g, "固定"],
  [/ダメージ上駅収/g, "ダメージ吸収"],
];

/** Normalise an OCR line of Japanese skill text. */
export function cleanOcrJapanese(raw: string): string {
  let text = toHalfWidth(raw);
  text = text.replace(/[|_]+/g, " ");
  // Japanese has no spaces: drop whitespace between CJK/kana characters and around punctuation.
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/([　-ヿ一-鿿、。、。])\s+(?=[　-ヿ一-鿿、。、。0-9\[])/g, "$1");
  text = text.replace(/\s+([、。])/g, "$1");
  text = text.replace(LOOKALIKE_RUN, fixDigitRun);
  for (const [pattern, replacement] of WORD_FIXES) text = text.replace(pattern, replacement);
  return text.trim();
}

function withCommas(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/**
 * Expand Japanese number units so the English side gets a plain figure:
 * "350億" → "35,000,000,000", "1000万" → "10,000,000", "2.5万" → "25,000".
 */
export function expandJapaneseNumbers(text: string): string {
  return text
    .replace(/(\d+(?:\.\d+)?)億(\d+(?:\.\d+)?)万/g, (_, oku: string, man: string) =>
      withCommas(Number(oku) * 1e8 + Number(man) * 1e4)
    )
    .replace(/(\d+(?:\.\d+)?)億/g, (_, n: string) => withCommas(Number(n) * 1e8))
    .replace(/(\d+(?:\.\d+)?)万/g, (_, n: string) => withCommas(Number(n) * 1e4));
}

/** Japanese terms replaced before machine translation so the PAD wording survives. */
export const PRE_TRANSLATION_GLOSSARY: Array<[RegExp, string]> = [
  [/【落ちコンなし】/g, "[No skyfall] "],
  [/落ちコンなし/g, "[No skyfall]"],
  [/ダメージ上限値/g, " damage cap "],
  [/ダメージ吸収/g, " damage absorb "],
  [/属性吸収/g, " attribute absorb "],
  [/無効貫通/g, " void damage piercer "],
  [/コンボ加算/g, " combo count "],
  [/落ちコン/g, " skyfall "],
];

/** Fixes applied to the English output of machine translation. */
export const POST_TRANSLATION_GLOSSARY: Array<[RegExp, string]> = [
  [/\b(invalidat(?:e|es|ed|ing)|nullif(?:y|ies|ied|ying)|disabl(?:e|es|ed|ing)|neutraliz(?:e|es|ed|ing))\b/gi, "void"],
  [/\bdamage absorption\b/gi, "damage absorb"],
  [/\battribute absorption\b/gi, "attribute absorb"],
  [/\b(upper limit of damage|damage limit|damage cap value|damage upper limit)\b/gi, "damage cap"],
  [/\bcombo addition\b/gi, "combo count"],
  [/\battack power\b/gi, "ATK"],
  [/\brecovery power\b/gi, "RCV"],
  [/\b(\d[\d,]*(?:\.\d+)?) times\b/gi, "x$1"],
  [/\bbattle (\d+) or later\b/gi, "floor $1 and after"],
  [/\s{2,}/g, " "],
];

export function applyPreTranslationGlossary(ja: string): string {
  let text = expandJapaneseNumbers(ja);
  for (const [pattern, replacement] of PRE_TRANSLATION_GLOSSARY) text = text.replace(pattern, replacement);
  return text.replace(/\s{2,}/g, " ").trim();
}

export function applyPostTranslationGlossary(en: string): string {
  let text = en;
  for (const [pattern, replacement] of POST_TRANSLATION_GLOSSARY) text = text.replace(pattern, replacement);
  return text.trim();
}

/** Japanese script present (hiragana, katakana, CJK). */
export function hasJapanese(text: string): boolean {
  return /[぀-ヿ㐀-鿿]/.test(text);
}
