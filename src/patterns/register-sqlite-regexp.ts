import type Database from "better-sqlite3";
import type { DataSource } from "typeorm";

const FLAG = "__padRegexpRegistered";

/**
 * Compiled-regex cache. Both SQL functions below are called once per row per
 * clause, so recompiling the same pattern thousands of times per query is the
 * single most expensive thing they do.
 */
const REGEX_CACHE = new Map<string, RegExp | null>();

function compile(pattern: string, flags: string): RegExp | null {
  const key = `${flags} ${pattern}`;
  const cached = REGEX_CACHE.get(key);
  if (cached !== undefined) return cached;
  let compiled: RegExp | null;
  try {
    compiled = new RegExp(pattern, flags);
  } catch {
    compiled = null;
  }
  REGEX_CACHE.set(key, compiled);
  return compiled;
}

/** "1,000" / "2.5" → number; NaN when the capture isn't numeric. */
function parseCapturedNumber(raw: string | undefined): number {
  if (raw == null) return Number.NaN;
  return Number(raw.replace(/,/g, ""));
}

/**
 * True when any occurrence of `pattern` in `value` yields a captured number
 * inside [min, max]. NULL bounds are unbounded. Used by the advanced
 * effect-value search (shield %, xN HP, charge turns, …) — the boolean
 * `regexp()` below can only say "this effect exists", not "how much".
 */
export function effectValueInRange(
  pattern: unknown,
  groupIndex: unknown,
  value: unknown,
  min: unknown,
  max: unknown
): 0 | 1 {
  if (pattern == null || value == null) return 0;
  const re = compile(String(pattern), "gi");
  if (!re) return 0;

  const group = Number(groupIndex);
  const groupNo = Number.isFinite(group) && group > 0 ? Math.trunc(group) : 1;
  const minNum = min == null ? null : Number(min);
  const maxNum = max == null ? null : Number(max);
  const text = String(value);

  re.lastIndex = 0;
  for (;;) {
    const m = re.exec(text);
    if (!m) return 0;
    const num = parseCapturedNumber(m[groupNo]);
    if (Number.isFinite(num)) {
      const okMin = minNum == null || !Number.isFinite(minNum) || num >= minNum;
      const okMax = maxNum == null || !Number.isFinite(maxNum) || num <= maxNum;
      if (okMin && okMax) return 1;
    }
    // Zero-length match guard — otherwise exec() would spin on the same index.
    if (m.index === re.lastIndex) re.lastIndex++;
  }
}

export function registerSqliteRegexp(db: Database.Database): void {
  const marked = db as Database.Database & { [FLAG]?: boolean };
  if (marked[FLAG]) return;

  db.function(
    "regexp",
    { deterministic: true },
    (pattern: unknown, value: unknown) => {
      if (pattern == null || value == null) return 0;
      const re = compile(String(pattern), "");
      if (!re) return 0;
      return re.test(String(value)) ? 1 : 0;
    }
  );

  db.function(
    "effect_value_in_range",
    { deterministic: true },
    effectValueInRange
  );

  marked[FLAG] = true;
}

export function registerDataSourceRegexp(dataSource: DataSource): void {
  const driver = dataSource.driver as {
    databaseConnection?: Database.Database;
  };
  const db = driver.databaseConnection;
  if (!db) {
    throw new Error("better-sqlite3 connection not available for REGEXP setup");
  }
  registerSqliteRegexp(db);
}
