export type MonsterRecord = {
  monster_id?: number;
  monster_no_na?: number | null;
  name_en?: string | null;
  name_jp?: string | null;
  hp_max?: number | null;
  atk_max?: number | null;
  rcv_max?: number | null;
  rarity?: number | null;
  attribute_1_id?: number | null;
  attribute_2_id?: number | null;
  attribute_3_id?: number | null;
  awakenings?: string | null;
  super_awakenings?: string | null;
  active_skill_name_en?: string | null;
  leader_skill_name_en?: string | null;
  active_skill_desc_en?: string | null;
  leader_skill_desc_en?: string | null;
  active_skill_tags?: string | null;
  leader_skill_tags?: string | null;
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

export type MonsterFilters = {
  rarity: Set<number>;
  attributes: Set<number>;
  hpMin: number | null;
  hpMax: number | null;
  atkMin: number | null;
  atkMax: number | null;
  rcvMin: number | null;
  rcvMax: number | null;
  idQuery: string;
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
  attributes: new Set(),
  hpMin: null,
  hpMax: null,
  atkMin: null,
  atkMax: null,
  rcvMin: null,
  rcvMax: null,
  idQuery: "",
};

export const EMPTY_SKILL_FILTERS: SkillFilters = {
  activeSkillText: "",
  leaderSkillText: "",
  skillTextMode: "both",
  selectedPatterns: [],
  patternMatch: "all",
};
