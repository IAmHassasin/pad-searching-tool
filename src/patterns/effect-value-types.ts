import type { SkillType } from "./pattern-types";

/** One regex that extracts a number out of a skill description. */
export type EffectValueMatcher = {
  skill_type: SkillType;
  regex: string;
  /**
   * Capture group holding the number (1-based). 0 = presence-only matcher
   * (the family only filters by turns, not by value).
   */
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
  /** False when the matchers carry no number (turns-only family). Default true. */
  supports_value?: boolean;
  /** True when the effect has a "For N turns," duration worth filtering on. */
  supports_turns?: boolean;
  /**
   * Effect chips (pattern tag keys) this family tunes. A selected chip shows
   * the family's inputs and its range is AND'ed into that chip's clause.
   */
  tags?: Partial<Record<SkillType, string[]>>;
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
  /** Restrict to matchers of one skill text; undefined = every matcher. */
  skillType?: SkillType;
  min: number | null;
  max: number | null;
  /** Duration bounds ("For N turns,") of the matched effect clause. */
  turnMin?: number | null;
  turnMax?: number | null;
  /**
   * Active skills only. The matched clause loops when its duration covers the
   * charged cooldown shared across `loopCopies` cards. Evolving skills use
   * that stage's CD.
   */
  loop?: boolean;
  /** 1, 2, or 3 copies of this active. Ignored unless `loop` is set. Default 1. */
  loopCopies?: 1 | 2 | 3;
};

/** Column expressions for the active-skill loop check. Built by search, never from user text. */
export type EffectLoopColumns = {
  cooldownExpr: string;
  chargesPerTurnExpr: string;
  /** Comma-separated max-level CD per evolving-skill stage. Empty for a single skill. */
  stageCooldownsExpr: string;
};
