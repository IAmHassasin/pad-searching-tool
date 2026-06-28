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
  leader_skill_name_en?: string | null;
  active_skill_desc_en?: string | null;
  leader_skill_desc_en?: string | null;
  active_skill_tags?: string | null;
  leader_skill_tags?: string | null;
  /** Awoken skill ids granted when this assist vanishes (GameWith supplement DB). */
  vanish_granted_awoken_ids?: number[] | null;
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
};
