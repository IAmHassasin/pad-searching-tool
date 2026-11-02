/**
 * Monster rows that exist in the source DB but are broken data and must never
 * appear in search results. Hidden on the app side so the DB stays untouched.
 *
 * - 56981 "CLAIRE": placeholder row (rarity 1, no skills, on_jp = 0, on_na = 0).
 */
export const HIDDEN_MONSTER_IDS: readonly number[] = [56981];

/** SQL clause excluding hidden monsters; `idExpr` must evaluate to the monster id. */
export function hiddenMonstersClause(
  idExpr: string,
  params: unknown[]
): string | null {
  if (!HIDDEN_MONSTER_IDS.length) return null;
  params.push(...HIDDEN_MONSTER_IDS);
  const placeholders = HIDDEN_MONSTER_IDS.map(() => "?").join(", ");
  return `${idExpr} NOT IN (${placeholders})`;
}
