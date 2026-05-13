import * as fs from "node:fs";
import * as path from "node:path";

/** Capture typed values from the matched column (e.g. turn count). */
export type FacetExtractor = {
  /** Key in pad_categorized.facet_json object, e.g. "turns". */
  key: string;
  /** JavaScript RegExp source; first match uses capture group `group` (default 1). */
  regex: string;
  /** 1-based capture group index (default 1). */
  group?: number;
  type?: "int" | "float" | "string";
};

/** One UI / filter bucket; optional match rules — add patterns or regex by hand. */
export type FilterTypeCategoryRule = {
  group: string;
  label: string;
  /** Stored in pad_categorized.category; defaults to label when omitted. */
  key?: string;
  /**
   * Row column to scan (e.g. active_skill_desc_en). If omitted, uses FILTER_DESC_COLUMN env or active_skill_desc_en.
   */
  sourceColumn?: string;
  /** Case-insensitive substring: match if any pattern is contained in the column text. */
  patterns?: string[];
  /** If set, match when this RegExp matches (after trimming); invalid regex is ignored. */
  regex?: string;
  /** When true, always matches (use sparingly, e.g. catch-all buckets). */
  matchAll?: boolean;
  /**
   * After the rule matches, run each extractor on the same column text (original casing).
   * Results merge into one JSON object per category row (e.g. { "turns": 3, "atkMult": 1.5 }).
   */
  facets?: FacetExtractor[];
};

export type FilterTypeCategoriesFile = {
  categories: FilterTypeCategoryRule[];
};

let cached: FilterTypeCategoriesFile | null | undefined;

function defaultConfigPath(): string {
  const fromEnv = process.env.FILTER_TYPE_CATEGORIES_PATH?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(process.cwd(), fromEnv);
  }
  return path.join(process.cwd(), "docs", "filter-type-categories.json");
}

/** Returns null if the file is missing or invalid; caches for process lifetime. */
export function loadFilterTypeCategories(): FilterTypeCategoriesFile | null {
  if (cached !== undefined) {
    return cached;
  }
  const filePath = defaultConfigPath();
  if (!fs.existsSync(filePath)) {
    cached = null;
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as FilterTypeCategoriesFile;
    if (!parsed || !Array.isArray(parsed.categories)) {
      cached = null;
      return null;
    }
    cached = parsed;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function resetFilterTypeCategoriesCache(): void {
  cached = undefined;
}

export function defaultDescColumnForRow(): string {
  return (
    process.env.FILTER_DESC_COLUMN?.trim() || "active_skill_desc_en"
  );
}

function cellText(row: Record<string, unknown>, column: string): string {
  const v = row[column];
  if (v === null || v === undefined) return "";
  return String(v);
}

function ruleMatches(
  rule: FilterTypeCategoryRule,
  row: Record<string, unknown>
): boolean {
  if (rule.matchAll === true) {
    return true;
  }
  const col = rule.sourceColumn?.trim() || defaultDescColumnForRow();
  const text = cellText(row, col).toLowerCase();

  if (rule.patterns?.length) {
    for (const p of rule.patterns) {
      if (!p) continue;
      if (text.includes(p.toLowerCase())) {
        return true;
      }
    }
  }

  if (rule.regex?.trim()) {
    try {
      const re = new RegExp(rule.regex.trim(), "i");
      if (re.test(cellText(row, col))) {
        return true;
      }
    } catch {
      // ignore invalid regex
    }
  }

  return false;
}

/** Category key written to pad_categorized.category */
export function categoryKeyForRule(rule: FilterTypeCategoryRule): string {
  const k = rule.key?.trim();
  if (k) return k;
  return rule.label;
}

function extractFacetsFromRule(
  rule: FilterTypeCategoryRule,
  row: Record<string, unknown>
): Record<string, unknown> | null {
  if (!rule.facets?.length) return null;
  const col = rule.sourceColumn?.trim() || defaultDescColumnForRow();
  const raw = cellText(row, col);
  const out: Record<string, unknown> = {};

  for (const f of rule.facets) {
    const key = f.key?.trim();
    if (!key || !f.regex?.trim()) continue;
    try {
      const re = new RegExp(f.regex.trim(), "i");
      const m = raw.match(re);
      const gi = f.group ?? 1;
      if (!m || m[gi] === undefined) continue;
      const s = m[gi];
      const t = f.type ?? "string";
      if (t === "int") {
        const n = parseInt(String(s), 10);
        if (!Number.isNaN(n)) out[key] = n;
      } else if (t === "float") {
        const n = parseFloat(String(s));
        if (Number.isFinite(n)) out[key] = n;
      } else {
        out[key] = s;
      }
    } catch {
      // invalid regex
    }
  }

  return Object.keys(out).length ? out : null;
}

/** One row per distinct category key; subcategory holds the rule group. */
export function matchFilterRules(
  row: Record<string, unknown>,
  file: FilterTypeCategoriesFile
): {
  category: string;
  subcategory: string;
  facets: Record<string, unknown> | null;
}[] {
  const byCategory = new Map<
    string,
    { group: string; facets: Record<string, unknown> }
  >();

  for (const rule of file.categories) {
    if (!ruleMatches(rule, row)) continue;
    const cat = categoryKeyForRule(rule);
    const extracted = extractFacetsFromRule(rule, row) ?? {};
    const prev = byCategory.get(cat);
    if (!prev) {
      byCategory.set(cat, {
        group: rule.group,
        facets: { ...extracted },
      });
    } else {
      byCategory.set(cat, {
        group: prev.group,
        facets: { ...prev.facets, ...extracted },
      });
    }
  }

  return [...byCategory.entries()].map(([category, { group, facets }]) => ({
    category,
    subcategory: group,
    facets: Object.keys(facets).length ? facets : null,
  }));
}
