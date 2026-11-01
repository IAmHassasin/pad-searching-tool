/**
 * Skill text search terms: `|` separates terms (all must match), `*` matches
 * any run of characters inside one effect clause (it never crosses `;`), so
 * `by * turn` hits "by 1 turn", "by 12 turns", …
 */
export function parseSkillTextTerms(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("|")
    .map((t) => t.trim())
    .filter((t) => t.replace(/\*/g, "").trim().length > 0);
}

/**
 * Case-insensitive wildcard match: the `*`-separated parts must appear in
 * order inside one `;` clause. Plain indexOf scans — linear in the text, so
 * user input never reaches the regex engine (no backtracking blow-up).
 */
export function skillGlobMatch(pattern: unknown, value: unknown): 0 | 1 {
  if (pattern == null || value == null) return 0;
  const parts = String(pattern).toLowerCase().split("*");
  for (const clause of String(value).toLowerCase().split(";")) {
    let at = 0;
    let ok = true;
    for (const part of parts) {
      if (!part) continue;
      const found = clause.indexOf(part, at);
      if (found < 0) {
        ok = false;
        break;
      }
      at = found + part.length;
    }
    if (ok) return 1;
  }
  return 0;
}

/** One term against one skill text column (plain → LIKE, wildcard → glob). */
export function skillTextTermSql(
  term: string,
  columnExpr: string,
  params: unknown[]
): string {
  if (term.includes("*")) {
    params.push(term);
    return `skill_glob(?, ${columnExpr}) = 1`;
  }
  params.push(`%${term}%`);
  return `LOWER(COALESCE(${columnExpr}, '')) LIKE LOWER(?)`;
}

/** Every term AND'ed against one column; null when there is no term. */
export function skillTextTermsSql(
  raw: string | null | undefined,
  columnExpr: string,
  params: unknown[]
): string | null {
  const terms = parseSkillTextTerms(raw);
  if (!terms.length) return null;
  const parts = terms.map((t) => skillTextTermSql(t, columnExpr, params));
  return parts.length === 1 ? parts[0] : `(${parts.join(" AND ")})`;
}

/**
 * Active skill cooldown filter. Both bounds → inclusive range; only one bound
 * → exact match on that value.
 */
export function cooldownSql(
  min: number | null | undefined,
  max: number | null | undefined,
  columnExpr: string,
  params: unknown[]
): string | null {
  const hasMin = min != null && Number.isFinite(min);
  const hasMax = max != null && Number.isFinite(max);
  if (hasMin && hasMax) {
    params.push(min, max);
    return `(${columnExpr} >= ? AND ${columnExpr} <= ?)`;
  }
  if (hasMin || hasMax) {
    params.push(hasMin ? min : max);
    return `${columnExpr} = ?`;
  }
  return null;
}
