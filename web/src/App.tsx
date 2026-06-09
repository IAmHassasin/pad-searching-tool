import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchHealth, fetchPatternGroups, searchAllMonsters } from "./api";
import { AdminPanel } from "./components/AdminPanel";
import { MonsterFilterPanel } from "./components/MonsterFilterPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { SkillFilterPanel } from "./components/SkillFilterPanel";
import { useAdminSession } from "./hooks/useAdminSession";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
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
  const [loadProgress, setLoadProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const queryClient = useQueryClient();
  const admin = useAdminSession();

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

  const searchKey = useMemo(
    () => ({
      rarity: [...debouncedMonster.rarity].sort(),
      attributes: [...debouncedMonster.attributes].sort(),
      hpMin: debouncedMonster.hpMin,
      hpMax: debouncedMonster.hpMax,
      atkMin: debouncedMonster.atkMin,
      atkMax: debouncedMonster.atkMax,
      rcvMin: debouncedMonster.rcvMin,
      rcvMax: debouncedMonster.rcvMax,
      idQuery: debouncedMonster.idQuery,
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

  const filtered = useMemo(() => search.data?.rows ?? [], [search.data]);

  const apiError = health.error ?? patternGroups.error ?? search.error ?? null;

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

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(220px,280px)_1fr_minmax(300px,420px)]">
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
        />
        <SkillFilterPanel
          filters={skillFilters}
          onChange={setSkillFilters}
          patternGroups={patternGroups.data}
          patternGroupsLoading={patternGroups.isLoading}
        />
      </div>
    </div>
  );
}
