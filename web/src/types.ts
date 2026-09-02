import { type AttributeSlotFilters } from "./monster-attributes";

export type MonsterRecord = {
  monster_id?: number;
  monster_no_na?: number | null;
  name_en?: string | null;
  name_jp?: string | null;
  base_id?: number | null;
  group_id?: number | null;
  collab_id?: number | null;
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
};

/** Inclusive numeric bound pair for one advanced effect-value filter. */
export type EffectValueRange = { min: number | null; max: number | null };

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
  /** Measured against the current DB snapshot — shown as an input hint. */
  min_observed?: number;
  max_observed?: number;
  cards_observed?: number;
};

export type EffectFamiliesManifest = {
  families: EffectFamilyDef[];
};

/**
 * Advanced numeric effect-value filters (shield %, xN HP, charge turns, …).
 * Sent to `GET /monsters/search` as `effect=familyId:min:max,…`; the server
 * extracts the number out of the skill description with the family's regex
 * (see exports/patterns/effect_value_families.json).
 */
export type AdvancedEffectFilters = {
  ranges: Partial<Record<EffectFamilyId, EffectValueRange>>;
};

export const EMPTY_ADVANCED_EFFECT_FILTERS: AdvancedEffectFilters = {
  ranges: {},
};

export function hasAdvancedEffectFilters(
  filters: AdvancedEffectFilters
): boolean {
  return Object.values(filters.ranges).some(
    (r) => r != null && (r.min != null || r.max != null)
  );
}

export function countAdvancedEffectFilters(
  filters: AdvancedEffectFilters
): number {
  return Object.values(filters.ranges).filter(
    (r) => r != null && (r.min != null || r.max != null)
  ).length;
}

/** `familyId:min:max` pairs for the `effect` query param / share URL. */
export function serializeAdvancedEffectFilters(
  filters: AdvancedEffectFilters
): string {
  const parts: string[] = [];
  for (const [familyId, range] of Object.entries(filters.ranges)) {
    if (!range || (range.min == null && range.max == null)) continue;
    parts.push(
      `${familyId}:${range.min ?? ""}:${range.max ?? ""}`
    );
  }
  return parts.join(",");
}

export function parseAdvancedEffectFilters(
  raw: string | null | undefined
): AdvancedEffectFilters {
  if (!raw?.trim()) return EMPTY_ADVANCED_EFFECT_FILTERS;
  const ranges: AdvancedEffectFilters["ranges"] = {};
  for (const spec of raw.split(",")) {
    const [familyId, minRaw, maxRaw] = spec.trim().split(":");
    if (!familyId) continue;
    const min = minRaw?.trim() ? Number(minRaw) : null;
    const max = maxRaw?.trim() ? Number(maxRaw) : null;
    if (min == null && max == null) continue;
    ranges[familyId] = {
      min: min != null && Number.isFinite(min) ? min : null,
      max: max != null && Number.isFinite(max) ? max : null,
    };
  }
  return { ranges };
}
