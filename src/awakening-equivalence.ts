/** One composite awakening replaces multiple copies of a base awakening. */
export type AwakeningEquivalenceRule = {
  composite: number;
  base: number;
  basePerComposite: number;
};

export const AWAKENING_EQUIVALENCE_RULES: AwakeningEquivalenceRule[] = [
  { composite: 56, base: 21, basePerComposite: 2 },
  { composite: 97, base: 51, basePerComposite: 2 },
  { composite: 142, base: 127, basePerComposite: 2 },
  { composite: 116, base: 22, basePerComposite: 3 },
  { composite: 117, base: 23, basePerComposite: 3 },
  { composite: 118, base: 24, basePerComposite: 3 },
  { composite: 119, base: 25, basePerComposite: 3 },
  { composite: 120, base: 26, basePerComposite: 3 },
  { composite: 96, base: 27, basePerComposite: 2 },
  { composite: 121, base: 73, basePerComposite: 2 },
  { composite: 122, base: 74, basePerComposite: 2 },
  { composite: 123, base: 75, basePerComposite: 2 },
  { composite: 124, base: 76, basePerComposite: 2 },
  { composite: 125, base: 77, basePerComposite: 2 },
  { composite: 107, base: 43, basePerComposite: 2 },
  { composite: 111, base: 61, basePerComposite: 2 },
  { composite: 108, base: 60, basePerComposite: 2 },
  { composite: 110, base: 78, basePerComposite: 2 },
  { composite: 112, base: 79, basePerComposite: 2 },
  { composite: 113, base: 80, basePerComposite: 2 },
  { composite: 114, base: 81, basePerComposite: 2 },
  { composite: 109, base: 48, basePerComposite: 2 },
  // "+" awakenings whose effect is exactly double the base (per awoken_skills desc_en).
  { composite: 52, base: 10, basePerComposite: 2 },
  { composite: 53, base: 19, basePerComposite: 2 },
  { composite: 98, base: 9, basePerComposite: 2 },
  { composite: 99, base: 14, basePerComposite: 2 },
  { composite: 100, base: 15, basePerComposite: 2 },
  { composite: 101, base: 16, basePerComposite: 2 },
  { composite: 102, base: 17, basePerComposite: 2 },
  { composite: 103, base: 18, basePerComposite: 2 },
  { composite: 104, base: 29, basePerComposite: 2 },
  { composite: 115, base: 20, basePerComposite: 2 },
];

const rulesAsBase = new Map<number, AwakeningEquivalenceRule[]>();
const rulesAsComposite = new Map<number, AwakeningEquivalenceRule[]>();

for (const rule of AWAKENING_EQUIVALENCE_RULES) {
  const baseRules = rulesAsBase.get(rule.base) ?? [];
  baseRules.push(rule);
  rulesAsBase.set(rule.base, baseRules);

  const compositeRules = rulesAsComposite.get(rule.composite) ?? [];
  compositeRules.push(rule);
  rulesAsComposite.set(rule.composite, compositeRules);
}

/** Rules where `filterId` is the smaller base awk (composite awks contribute). */
export function equivalenceRulesAsBase(
  filterId: number
): readonly AwakeningEquivalenceRule[] {
  return rulesAsBase.get(filterId) ?? [];
}

/** Rules where `filterId` is the larger composite awk (base awks contribute). */
export function equivalenceRulesAsComposite(
  filterId: number
): readonly AwakeningEquivalenceRule[] {
  return rulesAsComposite.get(filterId) ?? [];
}

/**
 * Required minimum count per awk id for an "all" match. Selected ids that belong
 * to the same equivalence family are folded into base units so their requirements
 * add up (e.g. one 56 + one 21 requires 3 x 21-equivalents, not 1 + 1 separately).
 */
export function requiredAwakeningCounts(
  awakeningIds: readonly number[]
): Map<number, number> {
  const required = new Map<number, number>();
  for (const id of awakeningIds) {
    const asComposite = equivalenceRulesAsComposite(id);
    if (asComposite.length === 1) {
      const rule = asComposite[0];
      required.set(
        rule.base,
        (required.get(rule.base) ?? 0) + rule.basePerComposite
      );
    } else {
      required.set(id, (required.get(id) ?? 0) + 1);
    }
  }
  return required;
}

/** Awk ids whose raw count must be evaluated when filtering for `filterId`. */
export function relatedAwakeningIdsForFilter(filterId: number): number[] {
  const ids = new Set<number>([filterId]);
  for (const rule of equivalenceRulesAsBase(filterId)) {
    ids.add(rule.composite);
  }
  for (const rule of equivalenceRulesAsComposite(filterId)) {
    ids.add(rule.base);
  }
  return [...ids];
}
