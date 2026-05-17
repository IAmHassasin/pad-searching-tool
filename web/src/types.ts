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
  active_skill_desc_en?: string | null;
  leader_skill_desc_en?: string | null;
  active_skill_tags?: string | null;
  leader_skill_tags?: string | null;
  __source_pk?: number;
};

export type CategoryBundleIndex = {
  sourceTable: string;
  generatedAt: string;
  files: { category: string; file: string; count: number }[];
};

export type CategoryBundleFile = {
  sourceTable: string;
  category: string;
  subcategory: string | null;
  monsters: { sourceRowId: number; facets: Record<string, unknown> | null }[];
};

export type FilterCategoryRule = {
  group: string;
  label: string;
  key?: string;
  tagIds?: number[];
  patterns?: string[];
};

export type FilterCategoriesManifest = {
  categories: FilterCategoryRule[];
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
  selectedCategories: { category: string; file: string }[];
  categoryMatch: "any" | "all";
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
  selectedCategories: [],
  categoryMatch: "any",
};
