export type SkillType = "active_skill" | "leader_skill";

export type PatternEntry = {
  example_matched_text: string;
  regex_pattern: string;
  skill_type: SkillType;
  status: string;
  tag_id: number | null;
  tag_name_en: string;
};

export type PatternsCatalogFile = {
  patterns: PatternEntry[];
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

export type PatternsGroupFile = {
  active_skill_filters: PatternFilterCategory[];
  leader_skill_filters: PatternFilterCategory[];
};

export type PatternTagSelection = {
  skillType: SkillType;
  tagKey: string;
};
