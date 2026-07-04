/** Active-skill pattern tags backed by supplement SQLite, not regex on skill text. */
export const VOID_SUPER_GRAVITY_TAG_KEY = "void_super_gravity";

const SUPPLEMENT_ACTIVE_SKILL_TAGS = new Set<string>([
  VOID_SUPER_GRAVITY_TAG_KEY,
]);

export function isSupplementActiveSkillTag(tagKey: string): boolean {
  return SUPPLEMENT_ACTIVE_SKILL_TAGS.has(tagKey);
}
