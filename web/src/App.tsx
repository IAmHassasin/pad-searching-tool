import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  fetchEffectFamilies,
  fetchHealth,
  fetchPatternGroups,
  searchAllMonsters,
  type SearchSnapshot,
} from "./api";
import { AdminLaunch } from "./components/AdminLaunch";
import { AppBrand } from "./components/AppBrand";
import { AppToolsNav } from "./components/AppToolsNav";
import { MobileWebviewLayout } from "./components/MobileWebviewLayout";
import { MonsterFilterPanel } from "./components/MonsterFilterPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { SkillFilterPanel } from "./components/SkillFilterPanel";
import {
  DEFAULT_AWK_MODIFIER_SETTINGS,
} from "./components/ResultsSortControls";
import { DEFAULT_RESULT_DISPLAY_SECTIONS } from "./lib/result-display";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { MonsterNameTranslationProvider } from "./hooks/useLiveMonsterNames";
import { useMobileWebview } from "./hooks/useMobileWebview";
import type { AwkModifierSettings } from "./lib/awakening-stat-modifier";
import type { ResultDisplaySections } from "./lib/result-display";
import {
  filterRowsByIdScope,
  type ResultIdScope,
} from "./lib/result-id-scope";
import {
  filterRowsByQuickFilter,
  type ResultQuickFilter,
} from "./lib/result-quick-filter";
import {
  buildShareSearchUrl,
  parseAdvancedEffectFiltersFromSearch,
  parseMonsterFiltersFromSearch,
  parsePatternTagKeysFromSearch,
  parseSkillFiltersFromSearch,
  resolveSelectedPatterns,
} from "./lib/monster-search-url";
import {
  sortMonsterRows,
  type ResultSortOption,
} from "./lib/results-sort";
import {
  EMPTY_MONSTER_FILTERS,
  EMPTY_SKILL_FILTERS,
  pruneEffectRanges,
  serializeAdvancedEffectFilters,
  type AdvancedEffectFilters,
  type MonsterFilters,
  type SkillFilters,
} from "./types";

function initialMonsterFilters(): MonsterFilters {
  return parseMonsterFiltersFromSearch(
    window.location.search,
    EMPTY_MONSTER_FILTERS
  );
}

function initialSkillFilters(): SkillFilters {
  return parseSkillFiltersFromSearch(window.location.search, EMPTY_SKILL_FILTERS);
}

function initialAdvancedEffectFilters(): AdvancedEffectFilters {
  return parseAdvancedEffectFiltersFromSearch(window.location.search);
}

export default function App() {
  const initialPatternKeys = useMemo(
    () => parsePatternTagKeysFromSearch(window.location.search),
    []
  );
  const [monsterFilters, setMonsterFilters] =
    useState<MonsterFilters>(initialMonsterFilters);
  const [skillFilters, setSkillFilters] =
    useState<SkillFilters>(initialSkillFilters);
  const [selected, setSelected] = useState<
    import("./types").MonsterRecord | null
  >(null);
  const [partialSearch, setPartialSearch] = useState<SearchSnapshot | null>(
    null
  );
  const [advancedEffectFilters, setAdvancedEffectFilters] =
    useState<AdvancedEffectFilters>(initialAdvancedEffectFilters);
  const [resultSort, setResultSort] = useState<ResultSortOption>("default");
  const [awkModifierSettings, setAwkModifierSettings] =
    useState<AwkModifierSettings>(DEFAULT_AWK_MODIFIER_SETTINGS);
  const [displaySections, setDisplaySections] =
    useState<ResultDisplaySections>(DEFAULT_RESULT_DISPLAY_SECTIONS);
  const [resultQuickFilter, setResultQuickFilter] =
    useState<ResultQuickFilter>(null);
  const [resultIdScope, setResultIdScope] = useState<ResultIdScope>("all");
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const isMobileWebview = useMobileWebview();

  const debouncedMonster = useDebouncedValue(monsterFilters, 300);
  const debouncedSkill = useDebouncedValue(skillFilters, 400);
  const debouncedEffects = useDebouncedValue(advancedEffectFilters, 400);

  const health = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: 1,
  });

  const patternGroups = useQuery({
    queryKey: ["patterns", "groups"],
    queryFn: fetchPatternGroups,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const effectFamilies = useQuery({
    queryKey: ["patterns", "effect-families"],
    queryFn: fetchEffectFamilies,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    if (!patternGroups.data) return;
    const hasPendingSharedTags =
      initialPatternKeys.activeTags.length > 0 ||
      initialPatternKeys.leaderTags.length > 0;
    if (!hasPendingSharedTags) return;
    setSkillFilters((current) => {
      if (current.selectedPatterns.length > 0) return current;
      return {
        ...current,
        selectedPatterns: resolveSelectedPatterns(
          patternGroups.data,
          initialPatternKeys
        ),
      };
    });
  }, [initialPatternKeys, patternGroups.data]);

  // Deselecting an effect chip drops the value / turn ranges it was tuning.
  const handleSkillFiltersChange = (next: SkillFilters) => {
    setSkillFilters(next);
    setAdvancedEffectFilters((current) =>
      pruneEffectRanges(
        current,
        next.selectedPatterns,
        effectFamilies.data?.families
      )
    );
  };

  const searchKey = useMemo(
    () => ({
      rarity: [...debouncedMonster.rarity].sort(),
      attributeSlots: debouncedMonster.attributeSlots.map((slot) =>
        [...slot].sort()
      ),
      attributeMatch: debouncedMonster.attributeMatch,
      types: [...debouncedMonster.types].sort(),
      hpMin: debouncedMonster.hpMin,
      hpMax: debouncedMonster.hpMax,
      atkMin: debouncedMonster.atkMin,
      atkMax: debouncedMonster.atkMax,
      rcvMin: debouncedMonster.rcvMin,
      rcvMax: debouncedMonster.rcvMax,
      idQuery: debouncedMonster.idQuery,
      awakeningIds: debouncedMonster.awakeningIds,
      excludedAwakeningIds: debouncedMonster.excludedAwakeningIds,
      awakeningPickerMode: debouncedMonster.awakeningPickerMode,
      vanishOnly: debouncedMonster.vanishOnly,
      vanishAwakeningIds: debouncedMonster.vanishAwakeningIds,
      activeSkillText: debouncedSkill.activeSkillText,
      leaderSkillText: debouncedSkill.leaderSkillText,
      skillTextMode: debouncedSkill.skillTextMode,
      activeCdMin: debouncedSkill.activeCdMin,
      activeCdMax: debouncedSkill.activeCdMax,
      patternMatch: debouncedSkill.patternMatch,
      selectedPatterns: debouncedSkill.selectedPatterns.map((p) => ({
        skillType: p.skillType,
        tagKey: p.tagKey,
      })),
      effect: serializeAdvancedEffectFilters(debouncedEffects),
    }),
    [debouncedMonster, debouncedSkill, debouncedEffects]
  );

  const [partialKey, setPartialKey] = useState(searchKey);
  if (partialKey !== searchKey) {
    setPartialKey(searchKey);
    setPartialSearch(null);
  }

  const search = useQuery({
    queryKey: ["monsters", "search", searchKey],
    queryFn: () =>
      searchAllMonsters(
        debouncedMonster,
        debouncedSkill,
        setPartialSearch,
        debouncedEffects
      ),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const snapshot = partialSearch ?? search.data;

  const filtered = useMemo(() => {
    const rows = snapshot?.rows ?? [];
    const sorted = sortMonsterRows(rows, resultSort, awkModifierSettings);
    return filterRowsByIdScope(
      filterRowsByQuickFilter(sorted, resultQuickFilter),
      resultIdScope
    );
  }, [snapshot, resultSort, awkModifierSettings, resultQuickFilter, resultIdScope]);

  const apiError = health.error ?? patternGroups.error ?? search.error ?? null;

  const handleShareFilter = async () => {
    const relativeUrl = buildShareSearchUrl(
      monsterFilters,
      skillFilters,
      advancedEffectFilters
    );
    const absoluteUrl = new URL(relativeUrl, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({
          title: "PAD Searching Tool filter",
          url: absoluteUrl,
        });
        setShareMsg("Filter link shared");
      } else {
        await navigator.clipboard.writeText(absoluteUrl);
        setShareMsg("Filter link copied");
      }
    } catch {
      setShareMsg("Share cancelled");
    }
    window.setTimeout(() => setShareMsg(null), 2000);
  };

  return (
    <MonsterNameTranslationProvider>
    <div className="flex h-full flex-col">
      <header
        className={`glass-bar relative z-40 flex h-[52px] shrink-0 items-center justify-between border-b border-white/[0.08] ${
          isMobileWebview ? "gap-2 px-3" : "gap-x-4 px-4"
        }`}
      >
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <AppBrand
            size={isMobileWebview ? 30 : 36}
            title={isMobileWebview ? "PST" : undefined}
          />
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${
              health.data?.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-[var(--color-accent)]/30 bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)]"
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                health.isLoading
                  ? "animate-pulse bg-[var(--color-muted)]"
                  : health.data?.ok
                    ? "bg-emerald-400"
                    : "bg-[var(--color-accent)]"
              }`}
            />
            {health.isLoading
              ? "API…"
              : health.data?.ok
                ? isMobileWebview
                  ? "API"
                  : "API online"
                : isMobileWebview
                  ? "Off"
                  : "API offline"}
          </span>
        </div>
        <div
          className={`flex min-w-0 items-center text-[11px] text-[var(--color-muted)] ${
            isMobileWebview
              ? "flex-nowrap gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : "flex-wrap justify-end gap-x-3 gap-y-1 text-xs"
          }`}
        >
          {snapshot && (
            <span className="shrink-0 font-mono tabular-nums text-[var(--color-fg)]">
              <span className="text-[var(--color-accent-strong)]">
                {snapshot.total.toLocaleString()}
              </span>
              {!isMobileWebview &&
                ` match${snapshot.total === 1 ? "" : "es"}`}
            </span>
          )}
          {patternGroups.data && (
            <span className="hidden font-mono tabular-nums sm:inline">
              {patternGroups.data.active_skill_filters.length +
                patternGroups.data.leader_skill_filters.length}{" "}
              pattern groups
            </span>
          )}
          {shareMsg && (
            <span className="shrink-0 text-[var(--color-secondary-strong)]">
              {shareMsg}
            </span>
          )}
          <button
            type="button"
            className="ds-btn pressable shrink-0 px-2.5 py-1 text-[11px] font-semibold"
            onClick={() => void handleShareFilter()}
          >
            {isMobileWebview ? "Share" : "Share filter"}
          </button>
          <AdminLaunch variant="chip" compact={isMobileWebview} />
        </div>
      </header>

      <AppToolsNav variant={isMobileWebview ? "compact" : "bar"} />

      {apiError && (
        <p className="shrink-0 border-b border-[var(--color-negative)]/30 bg-[var(--color-negative)]/10 px-4 py-2 text-sm text-red-200">
          {apiError instanceof Error ? apiError.message : String(apiError)}
          <span className="block text-xs opacity-80">
            Start backend: npm run pad -- serve
          </span>
        </p>
      )}

      {isMobileWebview ? (
        <MobileWebviewLayout
          monsterFilters={monsterFilters}
          onMonsterFiltersChange={setMonsterFilters}
          skillFilters={skillFilters}
          onSkillFiltersChange={handleSkillFiltersChange}
          patternGroups={patternGroups.data}
          patternGroupsLoading={patternGroups.isLoading}
          rows={filtered}
          totalLoaded={snapshot?.total ?? 0}
          selected={selected}
          onSelect={setSelected}
          loading={search.isFetching}
          loadProgress={
            search.isFetching && snapshot ? snapshot.rows.length : null
          }
          resultSort={resultSort}
          onResultSortChange={setResultSort}
          awkModifierSettings={awkModifierSettings}
          onAwkModifierSettingsChange={setAwkModifierSettings}
          displaySections={displaySections}
          onDisplaySectionsChange={setDisplaySections}
          resultQuickFilter={resultQuickFilter}
          onResultQuickFilterChange={setResultQuickFilter}
          resultIdScope={resultIdScope}
          onResultIdScopeChange={setResultIdScope}
          advancedEffectFilters={advancedEffectFilters}
          onAdvancedEffectFiltersChange={setAdvancedEffectFilters}
          effectFamilies={effectFamilies.data?.families}
          modernOnly={snapshot?.modernOnly}
          minMonsterId={snapshot?.minMonsterId}
        />
      ) : (
        // Plain flex row, not a grid: below `xl` (1280px) isMobileWebview is
        // already true (see useMobileWebview), so there's no narrower desktop
        // state to fall back to — each side panel manages its own width via
        // useResizablePanel/ResizableSidePanel instead of a fixed column %.
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <MonsterFilterPanel
            filters={monsterFilters}
            onChange={setMonsterFilters}
          />
          <ResultsPanel
            rows={filtered}
            totalLoaded={snapshot?.total ?? 0}
            selected={selected}
            onSelect={setSelected}
            loading={search.isFetching}
            loadProgress={
              search.isFetching && snapshot ? snapshot.rows.length : null
            }
            resultSort={resultSort}
            onResultSortChange={setResultSort}
            awkModifierSettings={awkModifierSettings}
            onAwkModifierSettingsChange={setAwkModifierSettings}
            displaySections={displaySections}
            onDisplaySectionsChange={setDisplaySections}
            resultQuickFilter={resultQuickFilter}
            onResultQuickFilterChange={setResultQuickFilter}
            resultIdScope={resultIdScope}
            onResultIdScopeChange={setResultIdScope}
            modernOnly={snapshot?.modernOnly}
            minMonsterId={snapshot?.minMonsterId}
          />
          <SkillFilterPanel
            filters={skillFilters}
            onChange={handleSkillFiltersChange}
            patternGroups={patternGroups.data}
            patternGroupsLoading={patternGroups.isLoading}
            advancedEffectFilters={advancedEffectFilters}
            onAdvancedEffectFiltersChange={setAdvancedEffectFilters}
            effectFamilies={effectFamilies.data?.families}
          />
        </div>
      )}
    </div>
    </MonsterNameTranslationProvider>
  );
}
