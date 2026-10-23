import type { SkillType } from "./pattern-types.ts";

/**
 * Official effect chips are dadguide tag ids. Skill text regexes miss a large
 * share of those tags (wording variants, "and" lists, evolving skills whose
 * tags live on subskills). Custom chips keep regex matching.
 */
export type EffectColumnExprs = {
  activeTags: string;
  leaderTags: string;
  monsterId: string;
};

export const DEFAULT_EFFECT_TAG_COLUMNS = {
  active: "active_skill_tags",
  leader: "leader_skill_tags",
  monsterId: "monster_id",
} as const;

export function skillTagIdFromKey(tagKey: string): number | null {
  if (!/^[0-9]+$/.test(tagKey)) return null;
  const id = Number(tagKey);
  if (!Number.isSafeInteger(id) || id < 0) return null;
  return id;
}

/** Dadguide stores tags as `(9),(80)`. `(19)` must not match `(190)` or `(119)`. */
export function skillTagsIncludeId(
  tags: string | null | undefined,
  tagId: number
): boolean {
  const normalized = `,${String(tags ?? "").replace(/ /g, "")},`;
  return normalized.includes(`,(${tagId}),`);
}

export function skillTagTokenSql(columnExpr: string): string {
  return `instr(',' || replace(COALESCE(${columnExpr}, ''), ' ', '') || ',', ',(' || ? || '),') > 0`;
}

/**
 * Active effects match the parent skill tags or any subskill (evolving / loop
 * skills often leave the parent tags empty and store the effect on a stage).
 */
export function appendEffectTagClause(
  skillType: SkillType,
  tagId: number,
  exprs: EffectColumnExprs,
  params: unknown[]
): string {
  const token = String(tagId);
  if (skillType === "active_skill") {
    params.push(token, token);
    return (
      `(${skillTagTokenSql(exprs.activeTags)} OR ${exprs.monsterId} IN (` +
      `SELECT m.monster_id FROM monsters m ` +
      `JOIN active_skills_subskills ss ON ss.active_skill_id = m.active_skill_id ` +
      `JOIN active_subskills sub ON sub.active_subskill_id = ss.active_subskill_id ` +
      `WHERE ${skillTagTokenSql("sub.tags")}` +
      `))`
    );
  }
  params.push(token);
  return `(${skillTagTokenSql(exprs.leaderTags)})`;
}

export function joinEffectClauses(
  clauses: string[],
  patternMatch: "any" | "all"
): string | null {
  if (!clauses.length) return null;
  const joiner = patternMatch === "all" ? " AND " : " OR ";
  return `(${clauses.join(joiner)})`;
}
