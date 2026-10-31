import type Database from "better-sqlite3";
import type { DataSource } from "typeorm";
import { effectDurationLoops, stageCooldownAt } from "./skill-charge-sql.ts";
import { skillGlobMatch } from "./skill-search-sql.ts";

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

function toBound(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function inBounds(num: number, min: number | null, max: number | null): boolean {
  return (min == null || num >= min) && (max == null || num <= max);
}

/**
 * Effect clause separators in dadguide text: `;` between effects, `N) ` for
 * evolving / random skill lists, `: ` after a condition ("If HP >= 50%: …").
 */
const CLAUSE_BOUNDARY = /;\s*|\b\d+\)\s|:\s/g;
const DURATION = /\bfor ([\d,]+) turns?\b/gi;

/**
 * Duration ("For N turns, …" or "… for N turns") of the effect clause holding
 * text[start, end). Prefers the nearest prefix, then the first suffix; null
 * when the clause has no duration.
 */
export function effectClauseTurns(
  text: string,
  start: number,
  end: number
): number | null {
  let segStart = 0;
  let segEnd = text.length;
  CLAUSE_BOUNDARY.lastIndex = 0;
  for (;;) {
    const b = CLAUSE_BOUNDARY.exec(text);
    if (!b) break;
    const bEnd = b.index + b[0].length;
    if (bEnd <= start) segStart = bEnd;
    else if (b.index >= end) {
      segEnd = b.index;
      break;
    }
    if (b[0].length === 0) CLAUSE_BOUNDARY.lastIndex++;
  }

  let prefix: number | null = null;
  const before = text.slice(segStart, start);
  DURATION.lastIndex = 0;
  for (;;) {
    const d = DURATION.exec(before);
    if (!d) break;
    prefix = parseCapturedNumber(d[1]);
  }
  if (prefix != null && Number.isFinite(prefix)) return prefix;

  DURATION.lastIndex = 0;
  const after = DURATION.exec(text.slice(end, segEnd));
  if (!after) return null;
  const suffix = parseCapturedNumber(after[1]);
  return Number.isFinite(suffix) ? suffix : null;
}

/**
 * True when any occurrence of `pattern` in `value` yields a captured number
 * inside [min, max] and its clause duration inside [turnMin, turnMax]. NULL
 * bounds are unbounded; group 0 skips the value check (presence-only
 * matcher). Used by the effect-value search (shield %, xN HP, charge turns,
 * …) — the boolean `regexp()` below can only say "this effect exists".
 */
function effectMatchCore(
  pattern: unknown,
  groupIndex: unknown,
  value: unknown,
  min: unknown,
  max: unknown,
  turnMin: unknown,
  turnMax: unknown,
  requireLoop: boolean,
  loopCooldown: unknown,
  loopCharges: unknown,
  loopStageCooldowns: unknown
): 0 | 1 {
  if (pattern == null || value == null) return 0;
  const re = compile(String(pattern), "gi");
  if (!re) return 0;

  const group = Number(groupIndex);
  const groupNo = Number.isFinite(group) && group >= 0 ? Math.trunc(group) : 1;
  const minNum = toBound(min);
  const maxNum = toBound(max);
  const turnMinNum = toBound(turnMin);
  const turnMaxNum = toBound(turnMax);
  const checkTurns = turnMinNum != null || turnMaxNum != null;
  const text = String(value);

  re.lastIndex = 0;
  for (;;) {
    const m = re.exec(text);
    if (!m) return 0;
    let ok = true;
    if (groupNo > 0) {
      const num = parseCapturedNumber(m[groupNo]);
      ok = Number.isFinite(num) && inBounds(num, minNum, maxNum);
    }
    if (ok && (checkTurns || requireLoop)) {
      const turns = effectClauseTurns(text, m.index, m.index + m[0].length);
      if (checkTurns) {
        ok = turns != null && inBounds(turns, turnMinNum, turnMaxNum);
      }
      if (ok && requireLoop) {
        const stageCd = stageCooldownAt(
          text,
          m.index,
          loopCooldown,
          loopStageCooldowns
        );
        ok = effectDurationLoops(turns, stageCd, loopCharges);
      }
    }
    if (ok) return 1;
    // Zero-length match guard — otherwise exec() would spin on the same index.
    if (m.index === re.lastIndex) re.lastIndex++;
  }
}

export function effectMatch(
  pattern: unknown,
  groupIndex: unknown,
  value: unknown,
  min: unknown,
  max: unknown,
  turnMin: unknown,
  turnMax: unknown
): 0 | 1 {
  return effectMatchCore(
    pattern,
    groupIndex,
    value,
    min,
    max,
    turnMin,
    turnMax,
    false,
    null,
    null,
    null
  );
}

/**
 * Same as {@link effectMatch}, plus the matched clause must loop: its duration
 * is at least ceil(stage cooldown / chargesPerTurn). `chargesPerTurn` includes
 * the natural 1 plus skill-charge awakenings. `stageCooldowns` is the
 * comma-separated per-stage list; stage 1 still uses `cooldown`.
 */
export function effectLoopMatch(
  pattern: unknown,
  groupIndex: unknown,
  value: unknown,
  min: unknown,
  max: unknown,
  turnMin: unknown,
  turnMax: unknown,
  cooldown: unknown,
  chargesPerTurn: unknown,
  stageCooldowns: unknown
): 0 | 1 {
  return effectMatchCore(
    pattern,
    groupIndex,
    value,
    min,
    max,
    turnMin,
    turnMax,
    true,
    cooldown,
    chargesPerTurn,
    stageCooldowns
  );
}

/** Value-only form of {@link effectMatch} (kept for existing SQL callers). */
export function effectValueInRange(
  pattern: unknown,
  groupIndex: unknown,
  value: unknown,
  min: unknown,
  max: unknown
): 0 | 1 {
  return effectMatch(pattern, groupIndex, value, min, max, null, null);
}

export function registerSqliteRegexp(db: Database.Database): void {
  const marked = db as Database.Database & { [FLAG]?: boolean };
  if (marked[FLAG]) return;

  db.function(
    "regexp",
    { deterministic: true },
    (pattern: unknown, value: unknown) => {
      if (pattern == null || value == null) return 0;
      // Skill text is not consistent about capitalization ("Recover" / "recover").
      const re = compile(String(pattern), "i");
      if (!re) return 0;
      return re.test(String(value)) ? 1 : 0;
    }
  );

  db.function(
    "effect_value_in_range",
    { deterministic: true },
    effectValueInRange
  );

  db.function("effect_match", { deterministic: true }, effectMatch);
  db.function("effect_loop", { deterministic: true }, effectLoopMatch);

  db.function("skill_glob", { deterministic: true }, skillGlobMatch);

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
