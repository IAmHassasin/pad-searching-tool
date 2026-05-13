import * as fs from "node:fs";
import * as path from "node:path";
import { Repository } from "typeorm";
import { PadCategorized } from "../entities/pad-categorized.entity";

export type CategoryBundleMonster = {
  sourceRowId: number;
  facets: Record<string, unknown> | null;
};

export type CategoryBundleFile = {
  sourceTable: string;
  category: string;
  subcategory: string | null;
  monsters: CategoryBundleMonster[];
};

export type CategoryBundleIndex = {
  sourceTable: string;
  generatedAt: string;
  files: { category: string; file: string; count: number }[];
};

function slugFileName(category: string): string {
  const base = category
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  const safe = base.length ? base : "category";
  return `${safe}.json`;
}

/**
 * Writes one JSON per distinct category under dir, plus index.json.
 * Intended for static FE imports (no need to list all monsters via API).
 */
export async function writeCategoryJsonBundles(
  repo: Repository<PadCategorized>,
  sourceTable: string,
  exportDir: string
): Promise<void> {
  const abs = path.isAbsolute(exportDir)
    ? exportDir
    : path.join(process.cwd(), exportDir);
  fs.mkdirSync(abs, { recursive: true });

  const rows = await repo.find({
    where: { sourceTable },
    order: { category: "ASC", sourceRowId: "ASC" },
  });

  const byCat = new Map<string, CategoryBundleMonster[]>();
  const meta = new Map<string, string | null>();

  for (const r of rows) {
    const list = byCat.get(r.category) ?? [];
    let facets: Record<string, unknown> | null = null;
    if (r.facetJson?.trim()) {
      try {
        const parsed = JSON.parse(r.facetJson) as unknown;
        facets =
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
      } catch {
        facets = null;
      }
    }
    list.push({ sourceRowId: r.sourceRowId, facets });
    byCat.set(r.category, list);
    if (!meta.has(r.category)) {
      meta.set(r.category, r.subcategory);
    }
  }

  const indexFiles: CategoryBundleIndex["files"] = [];

  for (const [category, monsters] of byCat) {
    const file = slugFileName(category);
    const bundle: CategoryBundleFile = {
      sourceTable,
      category,
      subcategory: meta.get(category) ?? null,
      monsters,
    };
    fs.writeFileSync(
      path.join(abs, file),
      JSON.stringify(bundle, null, 2),
      "utf8"
    );
    indexFiles.push({ category, file, count: monsters.length });
  }

  indexFiles.sort((a, b) => a.category.localeCompare(b.category));

  const index: CategoryBundleIndex = {
    sourceTable,
    generatedAt: new Date().toISOString(),
    files: indexFiles,
  };
  fs.writeFileSync(
    path.join(abs, "index.json"),
    JSON.stringify(index, null, 2),
    "utf8"
  );
}
