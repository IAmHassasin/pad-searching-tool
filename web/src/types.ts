import { type AttributeSlotFilters } from "./monster-attributes";

export type MonsterRecord = {
  monster_id?: number;
  monster_no_na?: number | null;
  name_en?: string | null;
  name_jp?: string | null;
  base_id?: number | null;
  group_id?: number | null;
  collab_id?: number | null;
  /** Set when the name query matched this card's group or collab title. */
  matched_group_name?: string | null;
  matched_group_kind?: "collab" | "group" | null;
  hp_max?: number | null;
  atk_max?: number | null;
  rcv_max?: number | null;
  /** % increase 99→110; 0 = no limit break. dadguide `limit_mult`. */
  limit_mult?: number | null;
  /** Monster EXP curve tier — used with limit_mult for LB rate. */
  exp?: number | null;
  /** Team cost — used with limit_mult for LB rate on some cards. */
  cost?: number | null;
  /** dadguide `transformations.to_monster_id` — post-transform form; max Lv.99. */
  is_transform_form?: boolean | number | null;
  /** Max latent slots (6 or 8). */
  latent_slots?: number | null;
  rarity?: number | null;
  attribute_1_id?: number | null;
  attribute_2_id?: number | null;
  attribute_3_id?: number | null;
  type_1_id?: number | null;
  type_2_id?: number | null;
  type_3_id?: number | null;
  awakenings?: string | null;
  super_awakenings?: string | null;
  sync_awsid?: number | null;
  active_skill_name_en?: string | null;
  active_skill_cooldown_min?: number | null;
  active_skill_cooldown_max?: number | null;
  /** Comma-separated max-level CD per evo-loop subskill stage (dadguide active_subskills). */
  active_skill_stage_cooldowns?: string | null;
  leader_skill_name_en?: string | null;
  active_skill_desc_en?: string | null;
  leader_skill_desc_en?: string | null;
  active_skill_tags?: string | null;
  leader_skill_tags?: string | null;
  /** dadguide `leader_skills.max_hp` — max HP multiplier of the leader skill. */
  leader_skill_max_hp?: number | null;
  /** dadguide `leader_skills.max_shield` — max damage reduction (0..1). */
  leader_skill_max_shield?: number | null;
  /** Awoken skill ids granted when this assist vanishes (GameWith supplement DB). */
  vanish_granted_awoken_ids?: number[] | null;
  /** Void super gravity duration in turns (Altema supplement DB). */
  void_super_gravity_turns?: number | null;
  __source_pk?: number;
};

export type PatternFilterTag = {
  tag_id: number | null;
  tag_name_en: string;
  label: string;
  patternCount?: number;
};

export type PatternFilterCategory = {
  category_id: string;
  category_name: string;
  tags: PatternFilterTag[];
};

export type PatternGroupsManifest = {
  active_skill_filters: PatternFilterCategory[];
  leader_skill_filters: PatternFilterCategory[];
};

export type SelectedPatternTag = {
  skillType: "active_skill" | "leader_skill";
  tagKey: string;
  label: string;
};

export type MonsterSearchResponse = {
  sourceLabel: string;
  mode: "query" | "table";
  patternMatch: "any" | "all";
  activeTags: string[];
  leaderTags: string[];
  total: number;
  limit: number;
  offset: number;
  /** Configured search floor; 0 if disabled. */
  minMonsterId: number;
  /** True when this response actually applied the min-ID floor. */
  modernOnly: boolean;
  rows: MonsterRecord[];
};

export type EvoTreeEdge = { from: number; to: number };

export type EvoTreeResponse = {
  monsterId: number;
  baseId: number;
  nodes: MonsterRecord[];
  edges: EvoTreeEdge[];
};

export type CollabGroupResponse = {
  monsterId: number;
  groupId: number;
  groupName: string | null;
  byRarity: { rarity: number; monsters: MonsterRecord[] }[];
};

export type MonsterFilters = {
  rarity: Set<number>;
  /** Per-slot filters: index 0 → attribute_1_id, etc. */
  attributeSlots: AttributeSlotFilters;
  attributeMatch: "any" | "all";
  types: Set<number>;
  hpMin: number | null;
  hpMax: number | null;
  atkMin: number | null;
  atkMax: number | null;
  rcvMin: number | null;
  rcvMax: number | null;
  idQuery: string;
  /** Ordered stack — duplicates allowed (e.g. three × HP+). */
  awakeningIds: number[];
  /** Must not have these awakening ids (checked in regular + super + sync). */
  excludedAwakeningIds: number[];
  /** Include | Exclude (slots) | Vanish (active-skill grants). */
  awakeningPickerMode: "include" | "exclude" | "vanish";
  /** Restrict results to monsters present in the vanish supplement DB. */
  vanishOnly: boolean;
  /** Ordered stack — awokens granted on vanish (active skill). */
  vanishAwakeningIds: number[];
};

export type SkillFilters = {
  activeSkillText: string;
  leaderSkillText: string;
  skillTextMode: "both" | "active" | "leader";
  selectedPatterns: SelectedPatternTag[];
  patternMatch: "any" | "all";
  /** Show all active-skill pattern tags; when false, only tags with icons. */
  activeSkillAdvancedFilters: boolean;
  /** Active skill CD (max skill level). One bound alone means "equals". */
  activeCdMin: number | null;
  activeCdMax: number | null;
};

export const EMPTY_MONSTER_FILTERS: MonsterFilters = {
  rarity: new Set(),
  attributeSlots: [new Set(), new Set(), new Set()],
  attributeMatch: "all",
  types: new Set(),
  hpMin: null,
  hpMax: null,
  atkMin: null,
  atkMax: null,
  rcvMin: null,
  rcvMax: null,
  idQuery: "",
  awakeningIds: [],
  excludedAwakeningIds: [],
  awakeningPickerMode: "include",
  vanishOnly: false,
  vanishAwakeningIds: [],
};

export const EMPTY_SKILL_FILTERS: SkillFilters = {
  activeSkillText: "",
  leaderSkillText: "",
  skillTextMode: "both",
  selectedPatterns: [],
  patternMatch: "all",
  activeSkillAdvancedFilters: false,
  activeCdMin: null,
  activeCdMax: null,
};

/**
 * Inclusive bounds for one effect-value filter: the effect's number and its
 * "For N turns," duration. `null` = unbounded on that side.
 */
export type EffectValueRange = {
  min: number | null;
  max: number | null;
  turnMin: number | null;
  turnMax: number | null;
};

export const EMPTY_EFFECT_VALUE_RANGE: EffectValueRange = {
  min: null,
  max: null,
  turnMin: null,
  turnMax: null,
};

function isRangeActive(r: EffectValueRange | undefined): r is EffectValueRange {
  return (
    r != null &&
    (r.min != null || r.max != null || r.turnMin != null || r.turnMax != null)
  );
}

/** Family ids come from the server manifest (`GET /patterns/effect-families`). */
export type EffectFamilyId = string;

/** One numeric skill-effect family the server can range-filter on. */
export type EffectFamilyDef = {
  id: EffectFamilyId;
  label: string;
  /** Which skill text the family reads — used for UI grouping. */
  group: "active" | "leader" | "both";
  unit: string;
  value_type: "int" | "float";
  step?: number;
  /** False when the family only filters by turns. Default true. */
  supports_value?: boolean;
  /** True when the effect has a "For N turns," duration (by-turn input). */
  supports_turns?: boolean;
  /** Effect chips (tag keys per skill type) this family tunes. */
  tags?: Partial<Record<SelectedPatternTag["skillType"], string[]>>;
  /** Measured against the current DB snapshot — shown as an input hint. */
  min_observed?: number;
  max_observed?: number;
  cards_observed?: number;
};

export type EffectFamiliesManifest = {
  families: EffectFamilyDef[];
};

/**
 * Range key: `familyId@a` / `familyId@l` tunes the active / leader chips the
 * family maps to; a bare `familyId` (old share links) applies globally.
 */
export type EffectRangeKey = string;

const SCOPE_SUFFIX: Record<SelectedPatternTag["skillType"], string> = {
  active_skill: "a",
  leader_skill: "l",
};

export function effectRangeKey(
  familyId: EffectFamilyId,
  skillType: SelectedPatternTag["skillType"]
): EffectRangeKey {
  return `${familyId}@${SCOPE_SUFFIX[skillType]}`;
}

/** Families that tune one effect chip. */
export function familiesForTag(
  families: EffectFamilyDef[] | undefined,
  skillType: SelectedPatternTag["skillType"],
  tagKey: string
): EffectFamilyDef[] {
  return (families ?? []).filter((f) =>
    (f.tags?.[skillType] ?? []).includes(tagKey)
  );
}

/**
 * Effect-value filters (shield %, xN HP, charge turns, …) plus their duration.
 * Sent to `GET /monsters/search` as
 * `effect=familyId[@a|@l]:min:max:turnMin:turnMax,…`; the server extracts the
 * numbers out of the skill description with the family's regex (see
 * exports/patterns/effect_value_families.json).
 */
export type AdvancedEffectFilters = {
  ranges: Partial<Record<EffectRangeKey, EffectValueRange>>;
};

export const EMPTY_ADVANCED_EFFECT_FILTERS: AdvancedEffectFilters = {
  ranges: {},
};

export function hasAdvancedEffectFilters(
  filters: AdvancedEffectFilters
): boolean {
  return Object.values(filters.ranges).some(isRangeActive);
}

export function countAdvancedEffectFilters(
  filters: AdvancedEffectFilters,
  skillType?: SelectedPatternTag["skillType"]
): number {
  return Object.entries(filters.ranges).filter(
    ([key, r]) =>
      isRangeActive(r) &&
      (!skillType || key.endsWith(`@${SCOPE_SUFFIX[skillType]}`))
  ).length;
}

/**
 * Drops scoped ranges whose family no longer tunes any selected chip, so a
 * deselected effect never leaves a hidden filter behind.
 */
export function pruneEffectRanges(
  filters: AdvancedEffectFilters,
  selected: SelectedPatternTag[],
  families: EffectFamilyDef[] | undefined
): AdvancedEffectFilters {
  if (!families) return filters;
  const live = new Set<EffectRangeKey>();
  for (const p of selected) {
    for (const f of familiesForTag(families, p.skillType, p.tagKey)) {
      live.add(effectRangeKey(f.id, p.skillType));
    }
  }
  let changed = false;
  const ranges: AdvancedEffectFilters["ranges"] = {};
  for (const [key, range] of Object.entries(filters.ranges)) {
    if (key.includes("@") && !live.has(key)) {
      changed = true;
      continue;
    }
    ranges[key] = range;
  }
  return changed ? { ranges } : filters;
}

/** `key:min:max:turnMin:turnMax` specs for the `effect` param / share URL. */
export function serializeAdvancedEffectFilters(
  filters: AdvancedEffectFilters
): string {
  const parts: string[] = [];
  for (const [key, range] of Object.entries(filters.ranges)) {
    if (!isRangeActive(range)) continue;
    const bounds = [range.min, range.max];
    if (range.turnMin != null || range.turnMax != null) {
      bounds.push(range.turnMin, range.turnMax);
    }
    parts.push([key, ...bounds.map((b) => b ?? "")].join(":"));
  }
  return parts.join(",");
}

export function parseAdvancedEffectFilters(
  raw: string | null | undefined
): AdvancedEffectFilters {
  if (!raw?.trim()) return EMPTY_ADVANCED_EFFECT_FILTERS;
  const ranges: AdvancedEffectFilters["ranges"] = {};
  const num = (s: string | undefined) => {
    if (!s?.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  for (const spec of raw.split(",")) {
    const [key, minRaw, maxRaw, turnMinRaw, turnMaxRaw] = spec
      .trim()
      .split(":");
    // Hand-edited links: an invalid scope would make every search a 400.
    if (!key || !/^[^@]+(@[al])?$/.test(key)) continue;
    const range: EffectValueRange = {
      min: num(minRaw),
      max: num(maxRaw),
      turnMin: num(turnMinRaw),
      turnMax: num(turnMaxRaw),
    };
    if (isRangeActive(range)) ranges[key] = range;
  }
  return { ranges };
}
