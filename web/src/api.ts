import type {
  CategoryBundleFile,
  CategoryBundleIndex,
  FilterCategoriesManifest,
  MonsterRecord,
} from "./types";

const base = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(
  /\/$/,
  ""
) ?? "";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export function fetchHealth() {
  return getJson<{ ok: boolean }>("/health");
}

export function fetchCategoryBundleIndex() {
  return getJson<CategoryBundleIndex>("/category-bundles/index");
}

export function fetchCategoryBundle(file: string) {
  const q = new URLSearchParams({ name: file });
  return getJson<CategoryBundleFile>(`/category-bundles/file?${q}`);
}

export function fetchFilterCategories() {
  return getJson<FilterCategoriesManifest>("/filter-categories");
}

export async function fetchSourceRecordsPage(
  limit: number,
  offset: number
): Promise<{ rows: MonsterRecord[] }> {
  const q = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const page = await getJson<{
    rows: MonsterRecord[];
    limit: number;
    offset: number;
  }>(`/source-records?${q}`);
  return { rows: page.rows };
}

export async function fetchAllSourceRecords(
  onProgress?: (loaded: number) => void
): Promise<MonsterRecord[]> {
  const limit = 5000;
  const all: MonsterRecord[] = [];
  let offset = 0;
  for (;;) {
    const { rows } = await fetchSourceRecordsPage(limit, offset);
    all.push(...rows);
    onProgress?.(all.length);
    if (rows.length < limit) break;
    offset += limit;
  }
  return all;
}
