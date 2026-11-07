import type { MonsterFilters, SkillFilters } from "../../types.ts";
import { hasActiveMonsterFilters } from "../../lib/filters.ts";

/**
 * Quick search only hits the API once the user narrowed something down —
 * an empty filter set would stream the whole monster table into the sidebar.
 */
export function hasAnyQuickSearchFilter(
  monster: MonsterFilters,
  skill: SkillFilters
): boolean {
  return (
    hasActiveMonsterFilters(monster) ||
    skill.selectedPatterns.length > 0 ||
    skill.activeCdMin != null ||
    skill.activeCdMax != null ||
    skill.activeSkillText.trim().length > 0 ||
    skill.leaderSkillText.trim().length > 0
  );
}

/** Stable React Query key for the current quick-search filters. */
export function quickSearchQueryKey(
  monster: MonsterFilters,
  skill: SkillFilters
): string {
  return JSON.stringify({
    rarity: [...monster.rarity].sort((a, b) => a - b),
    attributeSlots: monster.attributeSlots.map((slot) =>
      [...slot].sort((a, b) => a - b)
    ),
    attributeMatch: monster.attributeMatch,
    types: [...monster.types].sort((a, b) => a - b),
    idQuery: monster.idQuery.trim(),
    awakeningIds: monster.awakeningIds,
    excludedAwakeningIds: monster.excludedAwakeningIds,
    vanishOnly: monster.vanishOnly,
    vanishAwakeningIds: monster.vanishAwakeningIds,
    activeSkillText: skill.activeSkillText.trim(),
    leaderSkillText: skill.leaderSkillText.trim(),
    skillTextMode: skill.skillTextMode,
    cd: [skill.activeCdMin, skill.activeCdMax],
    patternMatch: skill.patternMatch,
    patterns: skill.selectedPatterns.map((p) => `${p.skillType}:${p.tagKey}`),
  });
}

/** Single-ID fields (team build): the picked id replaces the current value. */
export function replaceIdValue(_current: string, id: number): string {
  return String(id);
}

/**
 * Multi-ID fields (tier maker "Card IDs"): append the id, separated by a
 * comma, unless it is already the last token.
 */
export function appendIdToList(current: string, id: number): string {
  const trimmed = current.trim().replace(/[\s,;]+$/, "");
  if (!trimmed) return String(id);
  const tokens = trimmed.split(/[\s,;]+/).filter(Boolean);
  if (tokens[tokens.length - 1] === String(id)) return trimmed;
  return `${trimmed}, ${id}`;
}
