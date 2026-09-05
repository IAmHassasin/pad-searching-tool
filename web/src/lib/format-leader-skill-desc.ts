/** dadguide leader skill placeholders, e.g. {{ awoskills.id48|default('???') }}. */
export const AWOSKILL_TEMPLATE_SPLIT_RE =
  /(\{\{\s*awoskills\.id\d+(?:\|default\([^)]*\))?\s*\}\})/gi;

const AWOSKILL_TEMPLATE_RE =
  /^\{\{\s*awoskills\.id(\d+)(?:\|default\([^)]*\))?\s*\}\}$/i;

export function isAwoskillTemplate(segment: string): boolean {
  return AWOSKILL_TEMPLATE_RE.test(segment);
}

export function parseAwoskillTemplateId(segment: string): number | null {
  const match = AWOSKILL_TEMPLATE_RE.exec(segment);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

/** Token inserted into custom skill / leader-skill text for an inline awk icon. */
export function formatAwoskillToken(awokenSkillId: number): string {
  return `{{ awoskills.id${awokenSkillId}|default('???') }}`;
}

/** Custom-card inline monster type icon (not Add Type awakenings). */
export const MONSTER_TYPE_TEMPLATE_SPLIT_RE =
  /(\{\{\s*types\.id\d+(?:\|default\([^)]*\))?\s*\}\})/gi;

const MONSTER_TYPE_TEMPLATE_RE =
  /^\{\{\s*types\.id(\d+)(?:\|default\([^)]*\))?\s*\}\}$/i;

export function isMonsterTypeTemplate(segment: string): boolean {
  return MONSTER_TYPE_TEMPLATE_RE.test(segment);
}

export function parseMonsterTypeTemplateId(segment: string): number | null {
  const match = MONSTER_TYPE_TEMPLATE_RE.exec(segment);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

export function formatMonsterTypeToken(typeId: number): string {
  return `{{ types.id${typeId}|default('???') }}`;
}

/** Custom-card inline skill-effect icons from sprite.webp effect columns. */
export const SKILL_EFFECT_TEMPLATE_SPLIT_RE =
  /(\{\{\s*skilleffects\.id\d+(?:\|default\([^)]*\))?\s*\}\})/gi;

const SKILL_EFFECT_TEMPLATE_RE =
  /^\{\{\s*skilleffects\.id(\d+)(?:\|default\([^)]*\))?\s*\}\}$/i;

export function isSkillEffectTemplate(segment: string): boolean {
  return SKILL_EFFECT_TEMPLATE_RE.test(segment);
}

export function parseSkillEffectTemplateId(segment: string): number | null {
  const match = SKILL_EFFECT_TEMPLATE_RE.exec(segment);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

export function formatSkillEffectToken(effectId: number): string {
  return `{{ skilleffects.id${effectId}|default('???') }}`;
}
