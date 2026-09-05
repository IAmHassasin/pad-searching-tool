import { useState } from "react";
import { useTruncatedTitle } from "../hooks/useTruncatedTitle";
import type { AwkModifierSettings } from "../lib/awakening-stat-modifier";
import type { ResultDisplaySections } from "../lib/result-display";
import type { ResultQuickFilter } from "../lib/result-quick-filter";
import type { ResultSortOption } from "../lib/results-sort";
import { countAdvancedEffectFilters } from "../types";
import type {
  AdvancedEffectFilters,
  EffectFamilyDef,
  MonsterFilters,
  MonsterRecord,
  PatternGroupsManifest,
  SkillFilters,
} from "../types";
import { MonsterDetailPanel } from "./MonsterDetailPanel";
import { ResultsDisplayControls } from "./ResultsDisplayControls";
import { ResultsList } from "./ResultsList";
import { ResultsQuickFilter } from "./ResultsQuickFilter";
import { ResultsSortControls } from "./ResultsSortControls";
import { AdvancedEffectFilterSection } from "./filters/advanced-effect-filter";
import {
  MonsterActiveFilterChips,
  MonsterAttributeFilter,
  MonsterTypeFilter,
  MonsterFilterClearButton,
  MonsterIdFilter,
  MonsterRarityFilter,
  MonsterStatsFilter,
  hasActiveMonsterFilters,
} from "./filters/monster-filter-shared";
import { MonsterAwakeningFilter } from "./filters/awakening-filter-shared";
import {
  SkillPatternGroup,
  SkillPatternSelectionBar,
  SkillTextSearchSection,
} from "./filters/skill-pattern-shared";

type BottomPanelMode =
  | "leader_skill"
  | "active_skill"
  | "awakening"
  | "by_text"
  | "advanced"
  | null;

type Props = {
  monsterFilters: MonsterFilters;
  onMonsterFiltersChange: (next: MonsterFilters) => void;
  skillFilters: SkillFilters;
  onSkillFiltersChange: (next: SkillFilters) => void;
  patternGroups: PatternGroupsManifest | undefined;
  patternGroupsLoading: boolean;
  advancedEffectFilters: AdvancedEffectFilters;
  onAdvancedEffectFiltersChange: (next: AdvancedEffectFilters) => void;
  effectFamilies: EffectFamilyDef[] | undefined;
  effectFamiliesLoading: boolean;
  rows: MonsterRecord[];
  totalLoaded: number;
  selected: MonsterRecord | null;
  onSelect: (row: MonsterRecord | null) => void;
  loading: boolean;
  loadProgress: number | null;
  resultSort: ResultSortOption;
  onResultSortChange: (sort: ResultSortOption) => void;
  awkModifierSettings: AwkModifierSettings;
  onAwkModifierSettingsChange: (next: AwkModifierSettings) => void;
  displaySections: ResultDisplaySections;
  onDisplaySectionsChange: (next: ResultDisplaySections) => void;
  resultQuickFilter: ResultQuickFilter;
  onResultQuickFilterChange: (next: ResultQuickFilter) => void;
};

function CollapseButton({
  expanded,
  onToggle,
  label,
}: {
  expanded: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-[#0d1117] text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-white"
    >
      <span aria-hidden className="text-sm leading-none">
        {expanded ? "▾" : "▸"}
      </span>
    </button>
  );
}

function MobileMonsterFilterBar({
  filters,
  onChange,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
}) {
  const active = hasActiveMonsterFilters(filters);

  return (
    <section className="flex h-[15vh] min-h-[7rem] max-h-[15vh] shrink-0 flex-col overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="flex shrink-0 items-center justify-between gap-2 px-2 py-1">
        <h2 className="text-xs font-semibold text-[var(--color-accent)]">
          Monster
        </h2>
        <div className="flex items-center gap-1">
          {active && (
            <MonsterFilterClearButton filters={filters} onChange={onChange} />
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <MonsterActiveFilterChips filters={filters} onChange={onChange} />
        <div className="mt-1 space-y-1.5">
          <MonsterRarityFilter
            filters={filters}
            onChange={onChange}
            compact
          />
          <MonsterAttributeFilter
            filters={filters}
            onChange={onChange}
            compact
          />
          <MonsterTypeFilter filters={filters} onChange={onChange} compact />
          <MonsterStatsFilter filters={filters} onChange={onChange} compact />
          <MonsterIdFilter filters={filters} onChange={onChange} compact />
        </div>
      </div>
    </section>
  );
}

function MobileDetailPanel({
  selected,
  collapsed,
  onToggleCollapsed,
  onClose,
  onSelect,
  showFullArt,
}: {
  selected: MonsterRecord;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClose: () => void;
  onSelect: (row: MonsterRecord) => void;
  showFullArt: boolean;
}) {
  const nameTitle = useTruncatedTitle<HTMLParagraphElement>(
    selected.name_en ?? "Details"
  );

  if (collapsed) {
    return (
      <aside className="flex w-8 shrink-0 flex-col items-center border-l border-[var(--color-border)] bg-[#0a0e12] py-2">
        <CollapseButton
          expanded={false}
          onToggle={onToggleCollapsed}
          label="details"
        />
        <span className="mt-2 text-[9px] text-[var(--color-muted)] [writing-mode:vertical-rl]">
          Detail
        </span>
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 w-[min(22.5rem,58%)] shrink-0 flex-col border-l border-[var(--color-border)] bg-[#0a0e12]">
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-[var(--color-border)] px-2 py-1">
        <p
          ref={nameTitle.ref}
          title={nameTitle.title}
          className="min-w-0 flex-1 truncate text-[10px] font-semibold text-white"
        >
          {selected.name_en ?? "Details"}
        </p>
        <CollapseButton
          expanded
          onToggle={onToggleCollapsed}
          label="details"
        />
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] hover:text-white"
          aria-label="Close details"
        >
          ×
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto pl-1 pr-2 py-1">
        <MonsterDetailPanel
          row={selected}
          onSelect={onSelect}
          sidebar
          showFullArt={showFullArt}
        />
      </div>
    </aside>
  );
}

function MobileBottomFilterBar({
  monsterFilters,
  onMonsterFiltersChange,
  skillFilters,
  onSkillFiltersChange,
  patternGroups,
  patternGroupsLoading,
  advancedEffectFilters,
  onAdvancedEffectFiltersChange,
  effectFamilies,
  effectFamiliesLoading,
}: {
  monsterFilters: MonsterFilters;
  onMonsterFiltersChange: (next: MonsterFilters) => void;
  skillFilters: SkillFilters;
  onSkillFiltersChange: (next: SkillFilters) => void;
  patternGroups: PatternGroupsManifest | undefined;
  patternGroupsLoading: boolean;
  advancedEffectFilters: AdvancedEffectFilters;
  onAdvancedEffectFiltersChange: (next: AdvancedEffectFilters) => void;
  effectFamilies: EffectFamilyDef[] | undefined;
  effectFamiliesLoading: boolean;
}) {
  const [openMode, setOpenMode] = useState<BottomPanelMode>(null);
  const [panelExpanded, setPanelExpanded] = useState(true);

  const toggleMode = (mode: BottomPanelMode) => {
    setOpenMode((current) => (current === mode ? null : mode));
    setPanelExpanded(true);
  };

  const selectedLeader = skillFilters.selectedPatterns.filter(
    (p) => p.skillType === "leader_skill"
  ).length;
  const selectedActive = skillFilters.selectedPatterns.filter(
    (p) => p.skillType === "active_skill"
  ).length;
  const selectedAwk =
    monsterFilters.awakeningIds.length +
    monsterFilters.excludedAwakeningIds.length;
  const selectedByText = [
    skillFilters.activeSkillText.trim(),
    skillFilters.leaderSkillText.trim(),
  ].filter(Boolean).length;
  const selectedEffects = countAdvancedEffectFilters(advancedEffectFilters);

  const panelTitle =
    openMode === "leader_skill"
      ? "Leader skill"
      : openMode === "active_skill"
        ? "Active skill"
        : openMode === "awakening"
          ? "Awakenings"
          : openMode === "by_text"
            ? "By Text"
            : openMode === "advanced"
              ? "Effect values"
              : "";

  return (
    <section className="flex shrink-0 flex-col border-t border-[var(--color-border)] bg-[var(--color-panel)]">
      {openMode && panelExpanded && (
        <div className="flex max-h-[28vh] min-h-0 flex-col border-b border-[var(--color-border)]">
          <div className="flex shrink-0 items-center justify-between gap-2 px-2 py-1">
            <CollapseButton
              expanded={panelExpanded}
              onToggle={() => setPanelExpanded(false)}
              label="filters"
            />
            <p className="text-xs font-semibold text-white">{panelTitle}</p>
            {openMode === "awakening" ? (
              (monsterFilters.awakeningIds.length > 0 ||
                monsterFilters.excludedAwakeningIds.length > 0) && (
                <button
                  type="button"
                  onClick={() =>
                    onMonsterFiltersChange({
                      ...monsterFilters,
                      awakeningIds: [],
                      excludedAwakeningIds: [],
                    })
                  }
                  className="rounded border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
                >
                  Clear all
                </button>
              )
            ) : openMode === "by_text" && selectedByText > 0 ? (
              <button
                type="button"
                onClick={() =>
                  onSkillFiltersChange({
                    ...skillFilters,
                    activeSkillText: "",
                    leaderSkillText: "",
                  })
                }
                className="rounded border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
              >
                Clear
              </button>
            ) : (
              <span className="w-12" aria-hidden />
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {openMode === "awakening" ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                <MonsterAwakeningFilter
                  filters={monsterFilters}
                  onChange={onMonsterFiltersChange}
                  compact
                />
              </div>
            ) : openMode === "by_text" ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                <SkillTextSearchSection
                  filters={skillFilters}
                  onChange={onSkillFiltersChange}
                  compact
                  embedded
                />
              </div>
            ) : openMode === "advanced" ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                <AdvancedEffectFilterSection
                  filters={advancedEffectFilters}
                  onChange={onAdvancedEffectFiltersChange}
                  families={effectFamilies}
                  loading={effectFamiliesLoading}
                  compact
                />
              </div>
            ) : (
              <>
                {patternGroupsLoading && (
                  <p className="shrink-0 px-2 pt-1 text-xs text-[var(--color-muted)]">
                    Loading groups…
                  </p>
                )}
                <div className="shrink-0 px-2 pt-1">
                  <SkillPatternSelectionBar
                    filters={skillFilters}
                    onChange={onSkillFiltersChange}
                    compact
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                  {patternGroups && openMode === "leader_skill" && (
                    <SkillPatternGroup
                      title="Leader skill"
                      skillType="leader_skill"
                      categories={patternGroups.leader_skill_filters}
                      filters={skillFilters}
                      onChange={onSkillFiltersChange}
                      compact
                    />
                  )}
                  {patternGroups && openMode === "active_skill" && (
                    <SkillPatternGroup
                      title="Active skill"
                      skillType="active_skill"
                      categories={patternGroups.active_skill_filters}
                      filters={skillFilters}
                      onChange={onSkillFiltersChange}
                      compact
                      iconOnly={!skillFilters.activeSkillAdvancedFilters}
                      defaultOpen
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {openMode && !panelExpanded && (
        <div className="flex shrink-0 items-center border-b border-[var(--color-border)] px-2 py-1">
          <CollapseButton
            expanded={false}
            onToggle={() => setPanelExpanded(true)}
            label="filters"
          />
          <span className="ml-2 text-[10px] text-[var(--color-muted)]">
            {panelTitle} collapsed
          </span>
        </div>
      )}

      <div className="grid shrink-0 grid-cols-5 gap-1 p-1.5">
        <button
          type="button"
          onClick={() => toggleMode("leader_skill")}
          className={`rounded-md border px-1 py-2 text-xs font-semibold transition-colors ${
            openMode === "leader_skill"
              ? "border-[#db6d28] bg-[#3d2814] text-[#f0c090]"
              : "border-[var(--color-border)] bg-[#0d1117] text-[var(--color-muted)]"
          }`}
        >
          Leader
          {selectedLeader > 0 && (
            <span className="ml-1 rounded bg-[var(--color-accent)]/20 px-1 text-[10px] tabular-nums">
              {selectedLeader}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => toggleMode("active_skill")}
          className={`rounded-md border px-1 py-2 text-xs font-semibold transition-colors ${
            openMode === "active_skill"
              ? "border-[#58a6ff] bg-[#1f3a5f] text-[var(--color-accent)]"
              : "border-[var(--color-border)] bg-[#0d1117] text-[var(--color-muted)]"
          }`}
        >
          Active
          {selectedActive > 0 && (
            <span className="ml-1 rounded bg-[var(--color-accent)]/20 px-1 text-[10px] tabular-nums">
              {selectedActive}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => toggleMode("awakening")}
          className={`rounded-md border px-1 py-2 text-xs font-semibold transition-colors ${
            openMode === "awakening"
              ? "border-[#6b8f3c] bg-[#1a2a12] text-[#a8c878]"
              : "border-[var(--color-border)] bg-[#0d1117] text-[var(--color-muted)]"
          }`}
        >
          Awk
          {selectedAwk > 0 && (
            <span className="ml-1 rounded bg-[#6b8f3c]/20 px-1 text-[10px] tabular-nums">
              {selectedAwk}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => toggleMode("by_text")}
          className={`rounded-md border px-1 py-2 text-xs font-semibold transition-colors ${
            openMode === "by_text"
              ? "border-[#39c5cf] bg-[#12333a] text-[#7ee7ef]"
              : "border-[var(--color-border)] bg-[#0d1117] text-[var(--color-muted)]"
          }`}
        >
          By Text
          {selectedByText > 0 && (
            <span className="ml-1 rounded bg-[#39c5cf]/20 px-1 text-[10px] tabular-nums">
              {selectedByText}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => toggleMode("advanced")}
          className={`rounded-md border px-1 py-2 text-xs font-semibold transition-colors ${
            openMode === "advanced"
              ? "border-[#a371f7] bg-[#2a1f3d] text-[#d4b8f7]"
              : "border-[var(--color-border)] bg-[var(--color-inset)] text-[var(--color-muted)]"
          }`}
          title="Numeric effect-value filters (shield %, xN HP, charge turns…)"
        >
          Values
          {selectedEffects > 0 && (
            <span className="ml-1 rounded bg-[#a371f7]/20 px-1 text-[10px] tabular-nums">
              {selectedEffects}
            </span>
          )}
        </button>
      </div>
    </section>
  );
}

export function MobileWebviewLayout({
  monsterFilters,
  onMonsterFiltersChange,
  skillFilters,
  onSkillFiltersChange,
  patternGroups,
  patternGroupsLoading,
  advancedEffectFilters,
  onAdvancedEffectFiltersChange,
  effectFamilies,
  effectFamiliesLoading,
  rows,
  totalLoaded,
  selected,
  onSelect,
  loading,
  loadProgress,
  resultSort,
  onResultSortChange,
  awkModifierSettings,
  onAwkModifierSettingsChange,
  displaySections,
  onDisplaySectionsChange,
  resultQuickFilter,
  onResultQuickFilterChange,
}: Props) {
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const showDetail = selected != null;

  const handleSelect = (row: MonsterRecord | null) => {
    onSelect(row);
    if (row) setDetailCollapsed(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <MobileMonsterFilterBar
        filters={monsterFilters}
        onChange={onMonsterFiltersChange}
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1.5">
          <div className="flex items-center gap-1">
            <h2 className="text-xs font-semibold">Results</h2>
            <ResultsQuickFilter
              value={resultQuickFilter}
              onChange={onResultQuickFilterChange}
              compact
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ResultsDisplayControls
              sections={displaySections}
              onSectionsChange={onDisplaySectionsChange}
              compact
            />
            <ResultsSortControls
              sort={resultSort}
              onSortChange={onResultSortChange}
              awkSettings={awkModifierSettings}
              onAwkSettingsChange={onAwkModifierSettingsChange}
              compact
            />
            <p className="text-[10px] text-[var(--color-muted)]">
              {loading
                ? `Loading… ${loadProgress ?? 0}`
                : `${rows.length} · ${totalLoaded}`}
            </p>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-h-0 min-w-0 flex-1 overflow-auto border-r border-[var(--color-border)]">
            <ResultsList
              rows={rows}
              selected={selected}
              onSelect={handleSelect}
              loading={loading}
              compact={!showDetail || detailCollapsed}
              minimal={showDetail && !detailCollapsed}
              resultSort={resultSort}
              displaySections={displaySections}
            />
          </div>

          {showDetail && (
            <MobileDetailPanel
              selected={selected}
              collapsed={detailCollapsed}
              onToggleCollapsed={() => setDetailCollapsed((v) => !v)}
              onClose={() => onSelect(null)}
              onSelect={(row) => handleSelect(row)}
              showFullArt={displaySections.fullArt}
            />
          )}
        </div>
      </main>

      <MobileBottomFilterBar
        monsterFilters={monsterFilters}
        onMonsterFiltersChange={onMonsterFiltersChange}
        skillFilters={skillFilters}
        onSkillFiltersChange={onSkillFiltersChange}
        patternGroups={patternGroups}
        patternGroupsLoading={patternGroupsLoading}
        advancedEffectFilters={advancedEffectFilters}
        onAdvancedEffectFiltersChange={onAdvancedEffectFiltersChange}
        effectFamilies={effectFamilies}
        effectFamiliesLoading={effectFamiliesLoading}
      />
    </div>
  );
}
