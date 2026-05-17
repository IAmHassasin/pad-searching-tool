import {
  loadFilterTypeCategories,
  matchFilterRules,
} from "./filter-type-categories";

/**
 * Map one source row to one or more category labels (multiple pad_categorized rows).
 */
export type CategorizeInput = {
  sourceTable: string;
  /** Raw row including SQLite rowid as __rowid when available. */
  row: Record<string, unknown>;
};

export type CategorizeOutput = {
  category: string;
  subcategory: string | null;
  /** Parsed filter facets (turn counts, multipliers, …) → pad_categorized.facet_json. */
  facets?: Record<string, unknown> | null;
  /** Stored in pad_categorized.summary_json — keep small. */
  summary?: Record<string, unknown>;
};

export function categorizePadRows(input: CategorizeInput): CategorizeOutput[] {
  const { row } = input;

  const columnCategory = process.env.CATEGORY_FROM_COLUMN;
  if (columnCategory && columnCategory in row && row[columnCategory] != null) {
    const category = String(row[columnCategory]);
    const subCol = process.env.SUBCATEGORY_FROM_COLUMN;
    const subcategory =
      subCol && subCol in row && row[subCol] != null
        ? String(row[subCol])
        : null;
    return [
      {
        category,
        subcategory,
        facets: null,
        summary: pickSummary(row),
      },
    ];
  }

  const filterFile = loadFilterTypeCategories();
  if (filterFile) {
    const hits = matchFilterRules(row, filterFile);
    if (hits.length) {
      return hits.map(({ category, subcategory, facets }) => ({
        category,
        subcategory,
        facets,
        summary: pickSummary(row),
      }));
    }
    return [];
  }

  const textBlob = JSON.stringify(row).toLowerCase();
  if (textBlob.includes("error") || textBlob.includes("fail")) {
    return [
      {
        category: "issue",
        subcategory: "likely_error_token",
        facets: null,
        summary: pickSummary(row),
      },
    ];
  }

  return [
    {
      category: "default",
      subcategory: null,
      facets: null,
      summary: pickSummary(row),
    },
  ];
}

function pickSummary(row: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(row).filter(
    (k) => !k.startsWith("__") && k !== "__source_pk"
  );
  const max = Number(process.env.SUMMARY_MAX_FIELDS ?? "32");
  const out: Record<string, unknown> = {};
  for (const k of keys.slice(0, max)) {
    const v = row[k];
    if (v === null) {
      out[k] = null;
      continue;
    }
    if (typeof v === "string" || typeof v === "number") {
      out[k] = v;
    }
  }
  return out;
}
