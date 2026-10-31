export type AwokenSkillBlurb = {
  name: string;
  description: string;
};

function cellText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Blank and the dadguide placeholder "Untranslated" are not display text. */
export function usableAwokenText(value: string): string {
  const text = value.trim();
  if (!text || text.toLowerCase() === "untranslated") return "";
  return text;
}

export function blurbFromAwokenRow(
  row: Record<string, unknown>
): { id: number; blurb: AwokenSkillBlurb } | null {
  const id = Number(row.awoken_skill_id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    blurb: {
      name: usableAwokenText(cellText(row.name_en)),
      description: usableAwokenText(cellText(row.desc_en)),
    },
  };
}

function columnAttackBlurb(color: string): AwokenSkillBlurb {
  return {
    name: `${color} Column Attack`,
    description:
      `7x ATK and +1 combo for each column of ${color} orbs matched. ` +
      "Deals damage equal to 2.5% of enemies' max HP at 15+ combos. " +
      "The combo bonus does not stack with multiple copies. " +
      "Connected columns in one match count as one column.",
  };
}

/**
 * Ids newer than the local dadguide dump (max 147). A later desc_en replaces these.
 * 148 is Assist Invalid Resist. 149–153 are the column attacks already approved.
 */
const NEWER_AWAKENING_BLURBS: Record<number, AwokenSkillBlurb> = {
  148: {
    name: "Resistance-Assist Invalid",
    description: "Blocks Assist Invalid attacks directed at itself",
  },
  149: columnAttackBlurb("Fire"),
  150: columnAttackBlurb("Water"),
  151: columnAttackBlurb("Wood"),
  152: columnAttackBlurb("Light"),
  153: columnAttackBlurb("Dark"),
};

function newerAwakeningBlurb(id: number): AwokenSkillBlurb | null {
  return NEWER_AWAKENING_BLURBS[id] ?? null;
}

/** Database text wins. Local copy fills a missing name or description. */
export function resolveAwokenSkillBlurb(
  id: number,
  fromDb: AwokenSkillBlurb | null
): AwokenSkillBlurb | null {
  const fallback = newerAwakeningBlurb(id);
  if (!fromDb) return fallback;
  if (!fallback) return fromDb;
  return {
    name: fromDb.name || fallback.name,
    description: fromDb.description || fallback.description,
  };
}
