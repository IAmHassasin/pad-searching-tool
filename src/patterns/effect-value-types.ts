import type { SkillType } from "./pattern-types";

/** One regex that extracts a number out of a skill description. */
export type EffectValueMatcher = {
  skill_type: SkillType;
  regex: string;
  /** Capture group holding the number (1-based). */
  value_group: number;
};

export type EffectValueFamily = {
  id: string;
  label: string;
  /** Which skill text(s) this family reads — UI grouping only. */
  group: "active" | "leader" | "both";
  unit: string;
  value_type: "int" | "float";
  /** Suggested input step for the UI. */
  step?: number;
  /** Measured against the current snapshot — UI hint only. */
  min_observed?: number;
  max_observed?: number;
  cards_observed?: number;
  matchers: EffectValueMatcher[];
};

export type EffectValueFamiliesFile = {
  families: EffectValueFamily[];
};

/** One user-supplied range filter. `null` bound = unbounded on that side. */
export type EffectValueRangeInput = {
  familyId: string;
  min: number | null;
  max: number | null;
};
