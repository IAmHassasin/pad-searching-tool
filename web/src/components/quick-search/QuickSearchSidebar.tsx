import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  fetchPatternGroups,
  searchAllMonsters,
  type SearchSnapshot,
} from "../../api";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { MonsterNameTranslationProvider } from "../../hooks/useLiveMonsterNames";
import { useMobileWebview } from "../../hooks/useMobileWebview";
import { useResizablePanel } from "../../hooks/useResizablePanel";
import { monsterRowId } from "../../lib/filters";
import type { MonsterRecord } from "../../types";
import { MonsterAwakeningFilter } from "../filters/awakening-filter-shared";
import { ActiveSkillCooldownField } from "../filters/effect-tuning";
import {
  MonsterActiveFilterChips,
  MonsterFilterClearButton,
  MonsterMoreFiltersGroup,
} from "../filters/monster-filter-shared";
import {
  SkillPatternGroup,
  SkillPatternSelectionBar,
  SkillTextSearchSection,
} from "../filters/skill-pattern-shared";
import { ResizableSidePanel } from "../ResizableSidePanel";
import { useQuickSearch } from "./QuickSearchContext";
import { QuickSearchResultList } from "./QuickSearchResultList";
import {
  hasAnyQuickSearchFilter,
  quickSearchQueryKey,
} from "./quick-search-helpers";

const COLLAPSED_LABEL = "Quick search";

function HeaderButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white/5 text-[var(--color-muted)] hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-accent-muted)] hover:text-[var(--color-accent-strong)]"
    >
      <span aria-hidden className="text-sm leading-none">
        {children}
      </span>
    </button>
  );
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  const qs = useQuickSearch();
  const { monsterFilters, setMonsterFilters, skillFilters, setSkillFilters } = qs;
  const [partial, setPartial] = useState<SearchSnapshot | null>(null);

  const debouncedMonster = useDebouncedValue(monsterFilters, 300);
  const debouncedSkill = useDebouncedValue(skillFilters, 400);
  const searchKey = useMemo(
    () => quickSearchQueryKey(debouncedMonster, debouncedSkill),
    [debouncedMonster, debouncedSkill]
  );
  const active = hasAnyQuickSearchFilter(debouncedMonster, debouncedSkill);

  // Drop the progressive snapshot of the previous query.
  const [partialKey, setPartialKey] = useState(searchKey);
  if (partialKey !== searchKey) {
    setPartialKey(searchKey);
    setPartial(null);
  }

  const patternGroups = useQuery({
    queryKey: ["patterns", "groups"],
    queryFn: fetchPatternGroups,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const search = useQuery({
    queryKey: ["quick-search", searchKey],
    queryFn: () =>
      searchAllMonsters(debouncedMonster, debouncedSkill, setPartial),
    enabled: active,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const snapshot = active ? (partial ?? search.data) : null;
  const rows = snapshot?.rows ?? [];
  const loading = active && search.isFetching;

  const handlePick = (row: MonsterRecord) => {
    qs.pick(monsterRowId(row));
  };

  const hasCd =
    skillFilters.activeCdMin != null || skillFilters.activeCdMax != null;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="glass-bar flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[var(--color-fg-strong)]">
            <span
              aria-hidden
              className="h-3.5 w-1 rounded-full bg-[var(--color-secondary)] shadow-[var(--shadow-glow-cyan)]"
            />
            Quick search
          </h2>
          <p className="truncate text-[10px] text-[var(--color-muted)]">
            {qs.target ? (
              <>
                Filling:{" "}
                <span className="font-semibold text-[var(--color-secondary-strong)]">
                  {qs.target.label}
                </span>
              </>
            ) : (
              "Click an ID field, then pick a card"
            )}
          </p>
        </div>
        {qs.target && (
          <button
            type="button"
            onClick={qs.clearTarget}
            className="pressable shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-fg-strong)]"
          >
            Unlink
          </button>
        )}
        <HeaderButton onClick={onClose} label="Collapse quick search">
          ‹
        </HeaderButton>
      </div>

      <div className="flex max-h-[52%] shrink-0 flex-col gap-1.5 overflow-y-auto border-b border-[var(--color-border)] px-2 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-[var(--color-faint)]">
            Filters apply as you tap
          </p>
          <MonsterFilterClearButton
            filters={monsterFilters}
            onChange={setMonsterFilters}
          />
        </div>
        <MonsterActiveFilterChips
          filters={monsterFilters}
          onChange={setMonsterFilters}
        />
        <MonsterAwakeningFilter
          filters={monsterFilters}
          onChange={setMonsterFilters}
          compact
          singleGroupMode
        />
        <MonsterMoreFiltersGroup
          filters={monsterFilters}
          onChange={setMonsterFilters}
          compact
          title="Monster"
          idleSummary="rarity · attribute · type · stats · id"
        />
        <SkillPatternSelectionBar
          filters={skillFilters}
          onChange={setSkillFilters}
          compact
        />
        {patternGroups.data ? (
          <SkillPatternGroup
            title="Active skill"
            skillType="active_skill"
            categories={patternGroups.data.active_skill_filters}
            filters={skillFilters}
            onChange={setSkillFilters}
            compact
            iconOnly
            extraActiveCount={hasCd ? 1 : 0}
            beforeTags={
              <ActiveSkillCooldownField
                filters={skillFilters}
                onChange={setSkillFilters}
                compact
              />
            }
          />
        ) : patternGroups.isLoading ? (
          <p className="px-1 text-[10px] text-[var(--color-muted)]">
            Loading skill groups…
          </p>
        ) : null}
        <SkillTextSearchSection
          filters={skillFilters}
          onChange={setSkillFilters}
          compact
        />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-1.5">
        <h3 className="ds-label text-[var(--color-fg)]">Results</h3>
        <p className="font-mono text-[10px] tabular-nums text-[var(--color-muted)]">
          {!active ? (
            "set a filter"
          ) : loading ? (
            `Loading… ${rows.length}`
          ) : (
            <>
              <span className="text-[var(--color-accent-strong)]">
                {rows.length}
              </span>
              {snapshot ? ` / ${snapshot.total}` : ""}
            </>
          )}
        </p>
      </div>

      {search.isError && (
        <p className="shrink-0 px-3 pb-1 text-[10px] text-[var(--color-negative)]">
          {search.error instanceof Error
            ? search.error.message
            : "Search failed"}
        </p>
      )}

      {active ? (
        <QuickSearchResultList
          rows={rows}
          loading={loading}
          canPick={qs.target != null}
          onPick={handlePick}
        />
      ) : (
        <p className="px-3 py-2 text-xs text-[var(--color-muted)]">
          Pick awakenings, type an ID or name, or choose an active skill tag to
          see cards here. Click a card to fill the active field.
        </p>
      )}
    </div>
  );
}

function MobileSidebar() {
  const qs = useQuickSearch();

  useEffect(() => {
    if (!qs.expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") qs.collapse();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [qs]);

  if (!qs.expanded) {
    return (
      <button
        type="button"
        onClick={qs.expand}
        aria-label={`Open ${COLLAPSED_LABEL}`}
        aria-expanded={false}
        className="glass-bar pressable fixed left-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1 rounded-r-2xl border border-l-0 border-white/10 px-1.5 py-3 text-[var(--color-muted)] shadow-[var(--shadow-float)] hover:text-[var(--color-accent-strong)]"
      >
        <span aria-hidden className="text-sm leading-none">
          🔍
        </span>
        <span className="ds-label [writing-mode:vertical-rl]">
          {COLLAPSED_LABEL}
        </span>
      </button>
    );
  }

  return (
    <>
      <div
        aria-hidden
        className="animate-fade-in fixed inset-0 z-[45] bg-black/45"
        onClick={qs.collapse}
      />
      <aside
        role="dialog"
        aria-label={COLLAPSED_LABEL}
        className="animate-fade-in fixed inset-y-0 left-0 z-50 flex w-[min(26rem,92vw)] flex-col border-r border-white/10 bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-float)]"
      >
        <SidebarContent onClose={qs.collapse} />
      </aside>
    </>
  );
}

function DesktopSidebar() {
  const qs = useQuickSearch();
  const panel = useResizablePanel({
    storageKey: "quick-search",
    side: "left",
    defaultWidth: 400,
    minWidth: 320,
    maxWidth: 640,
  });

  return (
    <ResizableSidePanel
      side="left"
      collapsed={!qs.expanded}
      width={panel.width}
      dragHandleProps={panel.dragHandleProps}
      collapsedLabel={COLLAPSED_LABEL}
      onExpandToggle={qs.toggleExpanded}
      ariaLabel="quick search"
    >
      <SidebarContent onClose={qs.collapse} />
    </ResizableSidePanel>
  );
}

/**
 * Card search docked beside the team build / tier maker body. Desktop: a
 * collapsible rail that expands into a resizable column. Mobile: an edge tab
 * that opens a left drawer. Always mounted so the entry point is visible.
 */
export function QuickSearchSidebar() {
  const isMobile = useMobileWebview();
  return (
    <MonsterNameTranslationProvider>
      {isMobile ? <MobileSidebar /> : <DesktopSidebar />}
    </MonsterNameTranslationProvider>
  );
}
