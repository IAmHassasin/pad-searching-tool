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
