import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchAllSourceRecords,
  fetchCategoryBundle,
  fetchCategoryBundleIndex,
  fetchHealth,
} from "./api";
import { MonsterFilterPanel } from "./components/MonsterFilterPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { SkillFilterPanel } from "./components/SkillFilterPanel";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import {
  buildCategoryIdSet,
  filterMonsters,
} from "./lib/filters";
import {
  EMPTY_MONSTER_FILTERS,
  EMPTY_SKILL_FILTERS,
  type MonsterFilters,
  type SkillFilters,
} from "./types";

export default function App() {
  const [monsterFilters, setMonsterFilters] =
    useState<MonsterFilters>(EMPTY_MONSTER_FILTERS);
  const [skillFilters, setSkillFilters] =
    useState<SkillFilters>(EMPTY_SKILL_FILTERS);
  const [selected, setSelected] = useState<
    import("./types").MonsterRecord | null
  >(null);
  const [loadProgress, setLoadProgress] = useState<number | null>(null);

  const debouncedSkill = useDebouncedValue(skillFilters, 400);

  const health = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: 1,
  });

  const bundleIndex = useQuery({
    queryKey: ["category-bundles", "index"],
    queryFn: fetchCategoryBundleIndex,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const monsters = useQuery({
    queryKey: ["source-records", "all"],
    queryFn: () => fetchAllSourceRecords(setLoadProgress),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  const bundleQueries = useQueries({
    queries: debouncedSkill.selectedCategories.map((s) => ({
      queryKey: ["category-bundles", "file", s.file],
      queryFn: () => fetchCategoryBundle(s.file),
      staleTime: Infinity,
      gcTime: Infinity,
      enabled: Boolean(s.file),
    })),
  });

  const bundleIdMap = useMemo(() => {
    const map = new Map<string, Set<number>>();
    debouncedSkill.selectedCategories.forEach((s, i) => {
      const data = bundleQueries[i]?.data;
      if (!data) return;
      map.set(
        s.file,
        new Set(data.monsters.map((m) => m.sourceRowId))
      );
    });
    return map;
  }, [debouncedSkill.selectedCategories, bundleQueries]);

  const loadedBundleCount = bundleQueries.filter((q) => q.isSuccess).length;

  const filtered = useMemo(() => {
    const rows = monsters.data ?? [];
    const categoryIds = buildCategoryIdSet(
      bundleIdMap,
      debouncedSkill.selectedCategories,
      debouncedSkill.categoryMatch
    );
    const bundlesLoading =
      debouncedSkill.selectedCategories.length > 0 &&
      loadedBundleCount < debouncedSkill.selectedCategories.length;
    if (bundlesLoading) return [];
    return filterMonsters(rows, monsterFilters, debouncedSkill, categoryIds);
  }, [
    monsters.data,
    monsterFilters,
    debouncedSkill,
    bundleIdMap,
    loadedBundleCount,
  ]);

  const apiError =
    health.error ?? bundleIndex.error ?? monsters.error ?? null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[#0d1117] px-4 py-2">
        <h1 className="text-base font-semibold">PAD Searching Tool</h1>
        <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
          <span
            className={
              health.data?.ok ? "text-emerald-400" : "text-amber-400"
            }
          >
            API {health.isLoading ? "…" : health.data?.ok ? "online" : "offline"}
          </span>
          {bundleIndex.data && (
            <span>{bundleIndex.data.files.length} categories</span>
          )}
        </div>
      </header>

      {apiError && (
        <p className="shrink-0 bg-red-950/80 px-4 py-2 text-sm text-red-200">
          {apiError instanceof Error ? apiError.message : String(apiError)}
          <span className="block text-xs opacity-80">
            Start backend: npm run pad -- serve (or transform + serve)
          </span>
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(220px,280px)_1fr_minmax(260px,320px)]">
        <MonsterFilterPanel
          filters={monsterFilters}
          onChange={setMonsterFilters}
        />
        <ResultsPanel
          rows={filtered}
          totalLoaded={monsters.data?.length ?? 0}
          selected={selected}
          onSelect={setSelected}
          loading={monsters.isLoading}
          loadProgress={loadProgress}
        />
        <SkillFilterPanel
          filters={skillFilters}
          onChange={setSkillFilters}
          bundleIndex={bundleIndex.data}
          bundleIndexLoading={bundleIndex.isLoading}
          loadedBundleCount={loadedBundleCount}
        />
      </div>
    </div>
  );
}
