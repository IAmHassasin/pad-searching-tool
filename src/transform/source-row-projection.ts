/**
 * Optional SOURCE_COLUMN_WHITELIST: comma-separated result column names (after JOIN aliases).
 * Internal keys __source_pk / __rowid are always preserved for transform id resolution.
 */

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const INTERNAL_KEYS = new Set([
  "__source_pk",
  "__rowid",
  "vanish_granted_awoken_ids",
]);

export function parseSourceColumnWhitelist(
  raw: string | undefined
): Set<string> | null {
  if (!raw?.trim()) return null;
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (!t) continue;
    if (!IDENT.test(t)) {
      throw new Error(
        `Invalid SOURCE_COLUMN_WHITELIST token "${t}". Use letters, digits, underscore only.`
      );
    }
    set.add(t);
  }
  return set.size ? set : null;
}

export function projectSourceRow(
  row: Record<string, unknown>,
  whitelist: Set<string> | null
): Record<string, unknown> {
  if (!whitelist) {
    return row;
  }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    if (INTERNAL_KEYS.has(k) || whitelist.has(k)) {
      out[k] = row[k];
    }
  }
  return out;
}

export function projectSourceRows(
  rows: Record<string, unknown>[],
  whitelist: Set<string> | null
): Record<string, unknown>[] {
  if (!whitelist) return rows;
  return rows.map((r) => projectSourceRow(r, whitelist));
}

/** Reads SOURCE_COLUMN_WHITELIST from env (shared by transform + API). */
export function getSourceColumnWhitelistFromEnv(): Set<string> | null {
  return parseSourceColumnWhitelist(process.env.SOURCE_COLUMN_WHITELIST);
}
