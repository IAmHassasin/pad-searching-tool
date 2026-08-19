import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { fetchHealth, fetchPatternGroups, searchAllMonsters } from "./api";
import { AdminPanel } from "./components/AdminPanel";
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
import { useAdminSession } from "./hooks/useAdminSession";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { useMobileWebview } from "./hooks/useMobileWebview";
import type { AwkModifierSettings } from "./lib/awakening-stat-modifier";
import type { ResultDisplaySections } from "./lib/result-display";
import {
  filterRowsByQuickFilter,
  type ResultQuickFilter,
} from "./lib/result-quick-filter";
import {
  buildShareSearchUrl,
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
  const [loadProgress, setLoadProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [skillPanelOpen, setSkillPanelOpen] = useState(true);
  const [resultSort, setResultSort] = useState<ResultSortOption>("default");
  const [awkModifierSettings, setAwkModifierSettings] =
    useState<AwkModifierSettings>(DEFAULT_AWK_MODIFIER_SETTINGS);
  const [displaySections, setDisplaySections] =
    useState<ResultDisplaySections>(DEFAULT_RESULT_DISPLAY_SECTIONS);
  const [resultQuickFilter, setResultQuickFilter] =
    useState<ResultQuickFilter>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const admin = useAdminSession();
  const isMobileWebview = useMobileWebview();

  const debouncedMonster = useDebouncedValue(monsterFilters, 300);
  const debouncedSkill = useDebouncedValue(skillFilters, 400);

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
      patternMatch: debouncedSkill.patternMatch,
      selectedPatterns: debouncedSkill.selectedPatterns.map((p) => ({
        skillType: p.skillType,
        tagKey: p.tagKey,
      })),
    }),
    [debouncedMonster, debouncedSkill]
  );

  const search = useQuery({
    queryKey: ["monsters", "search", searchKey],
    queryFn: () =>
      searchAllMonsters(debouncedMonster, debouncedSkill, (loaded, total) =>
        setLoadProgress({ loaded, total })
      ),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const filtered = useMemo(() => {
    const rows = search.data?.rows ?? [];
    const sorted = sortMonsterRows(rows, resultSort, awkModifierSettings);
    return filterRowsByQuickFilter(sorted, resultQuickFilter);
  }, [search.data, resultSort, awkModifierSettings, resultQuickFilter]);

  const apiError = health.error ?? patternGroups.error ?? search.error ?? null;

  const handleShareFilter = async () => {
    const relativeUrl = buildShareSearchUrl(monsterFilters, skillFilters);
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
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[#0d1117] px-4 py-2">
        <AppBrand />
        <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
          <button
            type="button"
            className="rounded border border-[var(--color-border)] px-2 py-0.5 text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-white"
            onClick={() => void handleShareFilter()}
          >
            Share filter
          </button>
          {shareMsg && <span>{shareMsg}</span>}
          <span
            className={
              health.data?.ok ? "text-emerald-400" : "text-amber-400"
            }
          >
            API {health.isLoading ? "…" : health.data?.ok ? "online" : "offline"}
          </span>
          {search.data && (
            <span>
              {search.data.total} match
              {search.data.total === 1 ? "" : "es"}
            </span>
          )}
          {patternGroups.data && (
            <span>
              {patternGroups.data.active_skill_filters.length +
                patternGroups.data.leader_skill_filters.length}{" "}
              pattern groups
            </span>
          )}
          {admin.adminEnabled && (
            <button
              type="button"
              className="rounded border border-[var(--color-border)] px-2 py-0.5 text-[var(--color-muted)] hover:border-amber-600 hover:text-amber-300"
              onClick={() => setAdminOpen(true)}
            >
              {admin.isSuperadmin ? "Admin" : "Admin login"}
            </button>
          )}
        </div>
      </header>

      <AppToolsNav />

      <AdminPanel
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        adminEnabled={admin.adminEnabled}
        isSuperadmin={admin.isSuperadmin}
        checking={admin.checking}
        username={admin.username}
        token={admin.token}
        onLogin={async (u, p) => {
          await admin.login(u, p);
        }}
        onLogout={admin.logout}
        onRefreshComplete={() => {
          void queryClient.invalidateQueries({ queryKey: ["monsters", "search"] });
        }}
      />

      {apiError && (
        <p className="shrink-0 bg-red-950/80 px-4 py-2 text-sm text-red-200">
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
          onSkillFiltersChange={setSkillFilters}
          patternGroups={patternGroups.data}
          patternGroupsLoading={patternGroups.isLoading}
          rows={filtered}
          totalLoaded={search.data?.total ?? 0}
          selected={selected}
          onSelect={setSelected}
          loading={search.isFetching}
          loadProgress={
            loadProgress && search.isFetching ? loadProgress.loaded : null
          }
          resultSort={resultSort}
          onResultSortChange={setResultSort}
          awkModifierSettings={awkModifierSettings}
          onAwkModifierSettingsChange={setAwkModifierSettings}
          displaySections={displaySections}
          onDisplaySectionsChange={setDisplaySections}
          resultQuickFilter={resultQuickFilter}
          onResultQuickFilterChange={setResultQuickFilter}
        />
      ) : (
        <div
          className={`grid min-h-0 flex-1 grid-cols-1 ${
            skillPanelOpen
              ? "xl:grid-cols-[25%_minmax(0,1fr)_25%]"
              : "xl:grid-cols-[25%_minmax(0,1fr)_auto]"
          }`}
        >
          <MonsterFilterPanel
            filters={monsterFilters}
            onChange={setMonsterFilters}
          />
          <ResultsPanel
            rows={filtered}
            totalLoaded={search.data?.total ?? 0}
            selected={selected}
            onSelect={setSelected}
            loading={search.isFetching}
            loadProgress={
              loadProgress && search.isFetching ? loadProgress.loaded : null
            }
            resultSort={resultSort}
            onResultSortChange={setResultSort}
            awkModifierSettings={awkModifierSettings}
            onAwkModifierSettingsChange={setAwkModifierSettings}
            displaySections={displaySections}
            onDisplaySectionsChange={setDisplaySections}
            resultQuickFilter={resultQuickFilter}
            onResultQuickFilterChange={setResultQuickFilter}
          />
          <SkillFilterPanel
            filters={skillFilters}
            onChange={setSkillFilters}
            patternGroups={patternGroups.data}
            patternGroupsLoading={patternGroups.isLoading}
            open={skillPanelOpen}
            onToggle={() => setSkillPanelOpen((v) => !v)}
          />
        </div>
      )}
    </div>
  );
}
