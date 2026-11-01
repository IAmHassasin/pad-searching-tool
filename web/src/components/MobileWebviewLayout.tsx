import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMonsterNameTranslation } from "../hooks/useLiveMonsterNames";
import { useTruncatedTitle } from "../hooks/useTruncatedTitle";
import type { AwkModifierSettings } from "../lib/awakening-stat-modifier";
import type { ResultDisplaySections } from "../lib/result-display";
import type { ResultIdScope } from "../lib/result-id-scope";
import { listedMonsterId } from "../lib/result-id-scope";
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
import { ModernOnlySearchHint } from "./ModernOnlySearchHint";
import { ResultIdScopeSwitcher } from "./ResultIdScopeSwitcher";
import { ResultsDisplayControls } from "./ResultsDisplayControls";
import { ResultsList } from "./ResultsList";
import { ResultsQuickFilter } from "./ResultsQuickFilter";
import { ResultsSortControls } from "./ResultsSortControls";
import {
  ActiveSkillCooldownField,
  SelectedEffectTuning,
  UnscopedEffectRangeChips,
} from "./filters/effect-tuning";
import {
  MonsterActiveFilterChips,
  MonsterFilterClearButton,
  MonsterMoreFiltersGroup,
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
  | "by_text";

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
  resultIdScope: ResultIdScope;
  onResultIdScopeChange: (next: ResultIdScope) => void;
  modernOnly?: boolean;
  minMonsterId?: number;
};

const PANEL_TITLES: Record<BottomPanelMode, string> = {
  leader_skill: "Leader skill",
  active_skill: "Active skill",
  awakening: "Awakenings",
  by_text: "By text",
};

const DOCK_ITEMS: {
  mode: BottomPanelMode;
  label: string;
  glyph: string;
  title?: string;
}[] = [
  { mode: "leader_skill", label: "Leader", glyph: "♛" },
  { mode: "active_skill", label: "Active", glyph: "⚡" },
  { mode: "awakening", label: "Awk", glyph: "✦" },
  { mode: "by_text", label: "Text", glyph: "Aa" },
];

function IconButton({
  onClick,
  label,
  children,
  expanded,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-sm leading-none text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-fg-strong)]"
    >
      <span aria-hidden>{children}</span>
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
    <section className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      {active && (
        <MonsterActiveFilterChips filters={filters} onChange={onChange} />
      )}
      <MonsterMoreFiltersGroup
        filters={filters}
        onChange={onChange}
        compact
        title="Monster"
        idleSummary=""
        headerExtra={
          active ? (
            <MonsterFilterClearButton filters={filters} onChange={onChange} />
          ) : null
        }
        contentClassName="max-h-[40vh] space-y-1.5 overflow-y-auto"
      />
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
  const displayName = useMonsterNameTranslation().nameFor(selected, "Details");
  const nameTitle = useTruncatedTitle<HTMLParagraphElement>(displayName);
  const listedId = listedMonsterId(selected);

  if (collapsed) {
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center border-l border-[var(--color-border)] bg-[var(--color-inset)] py-2">
        <IconButton onClick={onToggleCollapsed} label="Expand details" expanded={false}>
          ‹
        </IconButton>
        <span className="ds-label mt-2 [writing-mode:vertical-rl]">Detail</span>
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 w-[min(22.5rem,58%)] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-inset)]">
      <div className="flex shrink-0 items-center justify-between gap-1.5 border-b border-[var(--color-border)] px-2 py-1.5">
        {listedId.region !== "none" && (
          <span
            className={`shrink-0 rounded-md bg-[var(--color-panel)] px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
              listedId.region === "jp"
                ? "text-[var(--color-secondary-strong)]"
                : "text-[var(--color-accent-strong)]"
            }`}
          >
            {listedId.text}
          </span>
        )}
        <p
          ref={nameTitle.ref}
          title={nameTitle.title}
          className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[var(--color-fg-strong)]"
        >
          {displayName}
        </p>
        <IconButton onClick={onToggleCollapsed} label="Collapse details" expanded>
          ›
        </IconButton>
        <IconButton onClick={onClose} label="Close details">
          ✕
        </IconButton>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto py-1 pl-1 pr-2">
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

function MobileFilterDock({
  monsterFilters,
  onMonsterFiltersChange,
  skillFilters,
  onSkillFiltersChange,
  patternGroups,
  patternGroupsLoading,
  advancedEffectFilters,
  onAdvancedEffectFiltersChange,
  effectFamilies,
  matchCount,
  loading,
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
  matchCount: number;
  loading: boolean;
}) {
  const [openMode, setOpenMode] = useState<BottomPanelMode | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Move focus into the sheet when it opens or switches mode so screen
  // readers announce it; Escape closes it.
  useEffect(() => {
    if (openMode) sheetRef.current?.focus({ preventScroll: true });
  }, [openMode]);

  const toggleMode = (mode: BottomPanelMode) => {
    setOpenMode((current) => (current === mode ? null : mode));
  };
  const closeSheet = () => setOpenMode(null);

  useEffect(() => {
    if (!openMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMode(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openMode]);

  const hasCd =
    skillFilters.activeCdMin != null || skillFilters.activeCdMax != null;
  const counts: Record<BottomPanelMode, number> = {
    leader_skill:
      skillFilters.selectedPatterns.filter(
        (p) => p.skillType === "leader_skill"
      ).length +
      countAdvancedEffectFilters(advancedEffectFilters, "leader_skill"),
    active_skill:
      skillFilters.selectedPatterns.filter(
        (p) => p.skillType === "active_skill"
      ).length +
      countAdvancedEffectFilters(advancedEffectFilters, "active_skill") +
      (hasCd ? 1 : 0),
    // Same fields MonsterAwakeningClearAllButton treats as active.
    awakening:
      monsterFilters.awakeningIds.length +
      monsterFilters.excludedAwakeningIds.length +
      monsterFilters.vanishAwakeningIds.length +
      (monsterFilters.vanishOnly ? 1 : 0),
    by_text: [
      skillFilters.activeSkillText.trim(),
      skillFilters.leaderSkillText.trim(),
    ].filter(Boolean).length,
  };

  const resetMode = (mode: BottomPanelMode) => {
    switch (mode) {
      case "leader_skill":
      case "active_skill":
        // Dropping the chips also prunes their value / turn ranges (App).
        onSkillFiltersChange({
          ...skillFilters,
          selectedPatterns: skillFilters.selectedPatterns.filter(
            (p) => p.skillType !== mode
          ),
          ...(mode === "active_skill"
            ? { activeCdMin: null, activeCdMax: null }
            : {}),
        });
        return;
      case "awakening":
        onMonsterFiltersChange({
          ...monsterFilters,
          awakeningIds: [],
          excludedAwakeningIds: [],
          vanishOnly: false,
          vanishAwakeningIds: [],
        });
        return;
      case "by_text":
        onSkillFiltersChange({
          ...skillFilters,
          activeSkillText: "",
          leaderSkillText: "",
        });
        return;
    }
  };

  return (
    <>
      {openMode && (
        // Pointer-only dismiss target; keyboard users have Escape and the ✕ button.
        <div
          aria-hidden
          className="animate-fade-in fixed inset-0 z-[45] bg-black/45"
          onClick={closeSheet}
        />
      )}

      {/* Only lift the dock above page modals (z-50) while its own sheet is open. */}
      <section
        className={`relative shrink-0 px-3 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] ${
          openMode ? "z-50" : "z-30"
        }`}
      >
        {openMode && (
          // Non-modal sheet: the dock stays interactive to switch modes.
          // Height is capped by the space left above the dock (app bar +
          // tools ribbon + dock ≈ 12rem) so the sheet header never clips.
          <div
            ref={sheetRef}
            role="dialog"
            tabIndex={-1}
            aria-label={`${PANEL_TITLES[openMode]} filters`}
            className="animate-sheet-in absolute inset-x-0 bottom-full flex max-h-[min(70dvh,36rem,calc(100dvh-12rem))] min-h-[min(40dvh,calc(100dvh-12rem))] flex-col rounded-t-3xl border-t border-white/10 bg-[var(--color-surface)] shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.7)] outline-none"
          >
            <div className="flex shrink-0 justify-center pt-2 pb-1" aria-hidden>
              <span className="h-1.5 w-12 rounded-full bg-slate-600" />
            </div>
            <div className="flex shrink-0 items-center gap-2 px-4 pb-2">
              <h2 className="text-base font-bold text-[var(--color-fg-strong)]">
                {PANEL_TITLES[openMode]}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-secondary)]/40 bg-[var(--color-secondary-muted)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-secondary-strong)]">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-secondary)]"
                />
                Live
              </span>
              <span className="flex-1" />
              {counts[openMode] > 0 && (
                <button
                  type="button"
                  onClick={() => resetMode(openMode)}
                  className="pressable inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--color-negative)] hover:bg-[var(--color-negative)]/10"
                >
                  <span aria-hidden>↺</span>
                  Reset
                </button>
              )}
              <IconButton onClick={closeSheet} label="Close filter sheet">
                ✕
              </IconButton>
            </div>

            <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--color-border)]">
              {openMode === "awakening" ? (
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                  <MonsterAwakeningFilter
                    filters={monsterFilters}
                    onChange={onMonsterFiltersChange}
                    compact
                  />
                </div>
              ) : openMode === "by_text" ? (
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                  <SkillTextSearchSection
                    filters={skillFilters}
                    onChange={onSkillFiltersChange}
                    compact
                    embedded
                  />
                </div>
              ) : (
                <>
                  {patternGroupsLoading && (
                    <p className="shrink-0 px-3 pt-2 text-xs text-[var(--color-muted)]">
                      Loading groups…
                    </p>
                  )}
                  <div className="shrink-0 px-3 pt-2">
                    <SkillPatternSelectionBar
                      filters={skillFilters}
                      onChange={onSkillFiltersChange}
                      compact
                    />
                    <UnscopedEffectRangeChips
                      effectFilters={advancedEffectFilters}
                      onEffectFiltersChange={onAdvancedEffectFiltersChange}
                      families={effectFamilies}
                      selectedPatterns={skillFilters.selectedPatterns}
                    />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
                    {patternGroups && openMode === "leader_skill" && (
                      <SkillPatternGroup
                        title="Leader skill"
                        skillType="leader_skill"
                        categories={patternGroups.leader_skill_filters}
                        filters={skillFilters}
                        onChange={onSkillFiltersChange}
                        compact
                        afterTags={
                          <SelectedEffectTuning
                            skillType="leader_skill"
                            skillFilters={skillFilters}
                            effectFilters={advancedEffectFilters}
                            onEffectFiltersChange={onAdvancedEffectFiltersChange}
                            families={effectFamilies}
                            compact
                          />
                        }
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
                        beforeTags={
                          <ActiveSkillCooldownField
                            filters={skillFilters}
                            onChange={onSkillFiltersChange}
                            compact
                          />
                        }
                        afterTags={
                          <SelectedEffectTuning
                            skillType="active_skill"
                            skillFilters={skillFilters}
                            effectFilters={advancedEffectFilters}
                            onEffectFiltersChange={onAdvancedEffectFiltersChange}
                            families={effectFamilies}
                            compact
                          />
                        }
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3 border-t border-white/10 bg-[var(--color-inset)]/80 px-4 py-2.5">
              <p className="min-w-0 flex-1 text-[11px] leading-tight text-[var(--color-muted)]">
                Matching database
                <span className="block font-mono text-xs font-semibold text-[var(--color-fg-strong)]">
                  {loading ? "Searching…" : `${matchCount.toLocaleString()} found`}
                </span>
              </p>
              <button
                type="button"
                onClick={closeSheet}
                className="ds-btn-primary pressable h-11 shrink-0 px-5 text-sm"
              >
                Show results
              </button>
            </div>
          </div>
        )}

        <nav
          aria-label="Filters"
          className="glass-bar grid h-14 grid-cols-4 gap-0.5 rounded-full border border-white/10 p-1 shadow-[var(--shadow-float)]"
        >
          {DOCK_ITEMS.map((item) => {
            const active = openMode === item.mode;
            const count = counts[item.mode];
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => toggleMode(item.mode)}
                aria-expanded={active}
                title={item.title}
                className={`pressable relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold leading-none ${
                  active
                    ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)] shadow-[var(--shadow-glow)]"
                    : count > 0
                      ? "text-[var(--color-fg-strong)] hover:bg-white/5"
                      : "text-[var(--color-muted)] hover:bg-white/5"
                }`}
              >
                <span aria-hidden className="font-mono text-sm leading-none">
                  {item.glyph}
                </span>
                <span>{item.label}</span>
                {count > 0 && (
                  <span className="absolute top-0.5 right-[18%] min-w-4 rounded-full bg-[var(--color-secondary)] px-1 font-mono text-[9px] font-bold leading-4 tabular-nums text-slate-950 shadow-[var(--shadow-glow-cyan)]">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </section>
    </>
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
  resultIdScope,
  onResultIdScopeChange,
  modernOnly,
  minMonsterId,
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
        <header className="flex shrink-0 flex-nowrap items-center justify-between gap-1.5 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
          <div className="flex shrink-0 items-center gap-1.5">
            <h2 className="ds-label text-[var(--color-fg)]">Results</h2>
            <ResultsQuickFilter
              value={resultQuickFilter}
              onChange={onResultQuickFilterChange}
              compact
            />
            <ResultIdScopeSwitcher
              value={resultIdScope}
              onChange={onResultIdScopeChange}
              compact
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
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
            <p className="font-mono text-[10px] tabular-nums text-[var(--color-muted)]">
              {loading ? (
                `Loading… ${loadProgress ?? 0}`
              ) : (
                <>
                  <span className="text-[var(--color-accent-strong)]">
                    {rows.length}
                  </span>
                  {` / ${totalLoaded}`}
                </>
              )}
            </p>
          </div>
        </header>

        <ModernOnlySearchHint
          modernOnly={modernOnly}
          minMonsterId={minMonsterId}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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

      <MobileFilterDock
        monsterFilters={monsterFilters}
        onMonsterFiltersChange={onMonsterFiltersChange}
        skillFilters={skillFilters}
        onSkillFiltersChange={onSkillFiltersChange}
        patternGroups={patternGroups}
        patternGroupsLoading={patternGroupsLoading}
        advancedEffectFilters={advancedEffectFilters}
        onAdvancedEffectFiltersChange={onAdvancedEffectFiltersChange}
        effectFamilies={effectFamilies}
        matchCount={rows.length}
        loading={loading}
      />
    </div>
  );
}
