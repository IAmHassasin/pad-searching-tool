import type { EnglishGlossary } from "./api";
import { convertJapaneseUnitsInText } from "./utils";

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

/** Fallback fragments when glossary misses (longest first). */
const PAD_WORD_FRAGMENTS: [string, string][] = [
  ["残り2体以下になると使用", "Used when ≤2 enemies remain"],
  ["残り1体以下になると使用", "Used when ≤1 enemy remains"],
  ["残り2体になると使用", "Used when 2 enemies remain"],
  ["出現時行動ターン", "Action cycle on spawn"],
  ["初回行動時、HP65%以上で使用", "First action above 65% HP"],
  ["HP65%以上で使用", "Above 65% HP"],
  ["HP50%以下で1回使用", "Once below 50% HP"],
  ["HP50%以下で使用", "Below 50% HP"],
  ["HP30%以下、通常行動", "Normal action below 30% HP"],
  ["ダメージ上限値", "damage cap "],
  ["サブダメージ上限値", "sub damage cap "],
  ["被ダメージ75%軽減", "75% damage reduction"],
  ["被ダメージ半減", "Incoming damage halved"],
  ["チームの攻撃力激減", "Team ATK greatly reduced"],
  ["敵の攻撃力", "Enemy ATK ×"],
  ["攻撃力激減", "ATK greatly reduced"],
  ["全員3ターンスキル遅延", "3-turn Skill Delay (all)"],
  ["全員4ターンスキル遅延", "4-turn Skill Delay (all)"],
  ["全員2ターンスキル遅延", "2-turn Skill Delay (all)"],
  ["全員ダメージ上限値", "All damage cap "],
  ["出現時行動ターン", "Action cycle on spawn"],
  ["ダメージの連続攻撃", " damage multi-hit attack"],
  ["左上1マスルーレット", "1-tile roulette top-left"],
  ["2×2マス雲", "2×2 cloud tiles"],
  ["3~5", "3–5"],
  ["スキル効果がない場合", "If no skill effect"],
  ["確定出現", "Guaranteed spawn"],
  ["初回行動時", "First action"],
  ["初回行動", "First action"],
  ["超根性発動時", "When Super Resolve triggers"],
  ["通常行動", "Normal action"],
  ["先制なし", "No preemptive"],
  ["左部位", "Left part"],
  ["右部位", "Right part"],
  ["各部位の防御", "Part DEF"],
  ["各部位", "Each part"],
  ["全ドロップ変化", "Change all orbs"],
  ["ランダム2属性吸収", "Absorb 2 random attributes"],
  ["ランダム1属性吸収", "Absorb 1 random attribute"],
  ["コンボ以下吸収", " combos or fewer absorb"],
  ["個生成", " orbs spawn"],
  ["以上無効", " or more void"],
  ["以上吸収", " or more absorb"],
  ["防御力", "DEF "],
  ["攻撃力", "ATK "],
  ["回復力", "RCV "],
  ["スキル封印", "Skill Bind"],
  ["スキル遅延", "Skill Delay"],
  ["属性吸収", "Attribute Absorb"],
  ["属性変化", "Attribute change"],
  ["連続攻撃", "multi-hit attack"],
  ["操作時間激減", "Time greatly reduced"],
  ["操作時間半減", "Time halved"],
  ["状態異常無効", "Status Shield"],
  ["覚醒無効", "Awoken Skill Bind"],
  ["全員", "All "],
  ["倍時", "× hit: "],
  ["倍", "×"],
  ["ターン", "-turn"],
  ["吸収", " absorb"],
  ["無効", " void"],
  ["生成", " spawn"],
  ["軽減", " reduction"],
  ["増加", " increase"],
  ["敵の", "Enemy "],
  ["部位", "Part "],
  ["防御", "DEF"],
  ["左", "Left "],
  ["右", "Right "],
  ["上", "Upper "],
  ["下", "Lower "],
  ["：", ": "],
  ["、", ", "],
  ["（", " ("],
  ["）", ")"],
  ["┗", "└ "],
];

function applyWordFragments(text: string): string {
  let out = text;
  for (const [ja, en] of PAD_WORD_FRAGMENTS) {
    if (out.includes(ja)) out = out.split(ja).join(en);
  }
  return out;
}

function normalizePunctuation(text: string): string {
  return text
    .replace(/[：]/g, ": ")
    .replace(/[、]/g, ", ")
    .replace(/[（]/g, " (")
    .replace(/[）]/g, ")")
    .replace(/[【]/g, "[")
    .replace(/[】]/g, "]")
    .replace(/[┗]/g, "└ ")
    .replace(/\s+/g, " ")
    .trim();
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

/** Glossary + PAD term substitution; output is English-only where possible. */
export function translateLine(text: string, glossary: EnglishGlossary): string {
  let out = text;
  for (const [ja, en] of phraseList(glossary)) {
    if (out.includes(ja)) out = out.split(ja).join(en);
  }
  out = applyWordFragments(out);
  out = convertJapaneseUnitsInText(out);
  out = normalizePunctuation(out);
  return out;
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
