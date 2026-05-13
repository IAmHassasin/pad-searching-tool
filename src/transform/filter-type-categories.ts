import * as fs from "node:fs";
import * as path from "node:path";

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

/** One row per distinct category key; subcategory holds the rule group. */
export function matchFilterRules(
  row: Record<string, unknown>,
  file: FilterTypeCategoriesFile
): { category: string; subcategory: string }[] {
  const byCategory = new Map<string, string>();
  for (const rule of file.categories) {
    if (ruleMatches(rule, row)) {
      const cat = categoryKeyForRule(rule);
      if (!byCategory.has(cat)) {
        byCategory.set(cat, rule.group);
      }
    }
  }
  return [...byCategory.entries()].map(([category, group]) => ({
    category,
    subcategory: group,
  }));
}
