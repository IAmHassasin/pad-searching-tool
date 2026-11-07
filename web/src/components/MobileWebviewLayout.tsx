import { useState } from "react";
import { useMonsterNameTranslation } from "../hooks/useLiveMonsterNames";
import { useTruncatedTitle } from "../hooks/useTruncatedTitle";
import type { AwkModifierSettings } from "../lib/awakening-stat-modifier";
import { hasAttributeSlotFilters } from "../lib/monster-attributes";
import {
  RESULT_DISPLAY_TABS,
  displayTabFromSections,
  sectionsForDisplayTab,
  type ResultDisplaySections,
} from "../lib/result-display";
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
import {
  MOBILE_FAB_BOTTOM_CLASS,
  MobileSheet,
  SheetIconButton,
} from "./MobileSheet";
import { ResultIdScopeSwitcher } from "./ResultIdScopeSwitcher";
import { ResultsDisplayControls } from "./ResultsDisplayControls";
import { ResultsList, type TeamDraftPanelProps } from "./ResultsList";
import { TeamDraftDock } from "./team-draft/TeamDraftDock";
import { ResultsQuickFilter } from "./ResultsQuickFilter";
import { ResultsSortControls } from "./ResultsSortControls";
import {
  ActiveSkillCooldownField,
  SelectedEffectTuning,
  UnscopedEffectRangeChips,
} from "./filters/effect-tuning";
import {
  MonsterActiveFilterChips,
  MonsterAttributeFilter,
  MonsterFilterClearButton,
  MonsterIdSearchInput,
  MonsterRarityFilter,
  MonsterTypeFilter,
  countMonsterChipFilters,
} from "./filters/monster-filter-shared";
import { MonsterAwakeningFilter } from "./filters/awakening-filter-shared";
import {
  SkillPatternGroup,
  SkillPatternSelectionBar,
  SkillTextSearchSection,
} from "./filters/skill-pattern-shared";

type SkillSheetMode = "leader_skill" | "active_skill" | "awakening" | "by_text";

/** Quick-chip sections of the monster filter sheet; `all` = header button. */
export type MobileMonsterSheetSection = "attribute" | "rarity" | "type" | "all";

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
  teamDraft?: TeamDraftPanelProps;
  /** Monster filter sheet (quick chips + header sliders button) — owned by App so the app bar can open it. */
  monsterSheet: MobileMonsterSheetSection | null;
  onMonsterSheetChange: (next: MobileMonsterSheetSection | null) => void;
};

const SKILL_SHEET_TITLES: Record<SkillSheetMode, string> = {
  leader_skill: "Leader skill",
  active_skill: "Active skill",
  awakening: "Awakenings",
  by_text: "By text",
};

const SKILL_SHEET_TABS: { mode: SkillSheetMode; label: string; glyph: string }[] = [
  { mode: "leader_skill", label: "Leader", glyph: "♛" },
  { mode: "active_skill", label: "Active", glyph: "⚡" },
  { mode: "awakening", label: "Awakenings", glyph: "✦" },
  { mode: "by_text", label: "Text", glyph: "Aa" },
];

function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M2 4.5h12M2 8h12M2 11.5h12" />
      <circle cx="5" cy="4.5" r="1.4" fill="var(--color-surface)" />
      <circle cx="10.5" cy="8" r="1.4" fill="var(--color-surface)" />
      <circle cx="6.5" cy="11.5" r="1.4" fill="var(--color-surface)" />
    </svg>
  );
}

/**
 * App-bar button (sliders icon + active badge) that opens the full monster
 * filter sheet. Rendered by App inside the mobile header.
 */
export function MobileMonsterFilterButton({
  filters,
  open,
  onClick,
}: {
  filters: MonsterFilters;
  open: boolean;
  onClick: () => void;
}) {
  const count = countMonsterChipFilters(filters);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={`Monster filters${count > 0 ? ` (${count} active)` : ""}`}
      title="Monster filters"
      className={`pressable relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
        count > 0 || open
          ? "border-[var(--color-accent)]/60 bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)] shadow-[var(--shadow-glow)]"
          : "border-[var(--color-border)] bg-[var(--color-inset)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-strong)]"
      }`}
    >
      <SlidersIcon className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-4 rounded-full bg-[var(--color-secondary)] px-1 font-mono text-[9px] font-bold leading-4 tabular-nums text-slate-950 shadow-[var(--shadow-glow-cyan)]">
          {count}
        </span>
      )}
    </button>
  );
}

function quickChipSummary(
  section: Exclude<MobileMonsterSheetSection, "all">,
  filters: MonsterFilters
): string | null {
  switch (section) {
    case "attribute": {
      const n = filters.attributeSlots.reduce((sum, slot) => sum + slot.size, 0);
      return n > 0 ? String(n) : null;
    }
    case "rarity":
      return filters.rarity.size > 0 ? String(filters.rarity.size) : null;
    case "type":
      return filters.types.size > 0 ? String(filters.types.size) : null;
  }
}

const QUICK_CHIPS: {
  section: Exclude<MobileMonsterSheetSection, "all">;
  label: string;
  glyph: string;
}[] = [
  { section: "attribute", label: "Attribute", glyph: "◉" },
  { section: "rarity", label: "Rarity", glyph: "★" },
  { section: "type", label: "Type", glyph: "⬢" },
];

function MobileQuickChipRow({
  filters,
  onOpen,
}: {
  filters: MonsterFilters;
  onOpen: (section: MobileMonsterSheetSection) => void;
}) {
  return (
    <div
      className="flex flex-nowrap items-center gap-1.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Quick filters"
    >
      {QUICK_CHIPS.map((chip) => {
        const summary = quickChipSummary(chip.section, filters);
        const active = summary != null;
        return (
          <button
            key={chip.section}
            type="button"
            onClick={() => onOpen(chip.section)}
            aria-haspopup="dialog"
            aria-pressed={active}
            className={`ds-pill pressable min-h-8 shrink-0 px-3 text-[11px] font-semibold ${
              active ? "ds-pill-active" : ""
            }`}
          >
            <span aria-hidden className="text-xs leading-none">
              {chip.glyph}
            </span>
            <span>{chip.label}</span>
            {active && (
              <span className="rounded-full bg-[var(--color-accent)]/20 px-1.5 font-mono text-[10px] tabular-nums">
                {summary}
              </span>
            )}
            <span aria-hidden className="text-[10px] opacity-70">
              ▾
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MobileMonsterFilterSheet({
  section,
  filters,
  onChange,
  onClose,
  matchCount,
  loading,
}: {
  section: MobileMonsterSheetSection | null;
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
  onClose: () => void;
  matchCount: number;
  loading: boolean;
}) {
  const hasChips =
    filters.rarity.size > 0 ||
    hasAttributeSlotFilters(filters.attributeSlots) ||
    filters.types.size > 0;
  const openAll = section === "all";

  return (
    <MobileSheet
      open={section != null}
      onClose={onClose}
      label="Monster filters"
      title="Monster filters"
      headerExtra={<MonsterFilterClearButton filters={filters} onChange={onChange} />}
      footer={<SheetResultsFooter matchCount={matchCount} loading={loading} onClose={onClose} />}
    >
      {/* Re-mount per requested section so its accordion opens on tap. */}
      <div key={section ?? "closed"} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {hasChips && <MonsterActiveFilterChips filters={filters} onChange={onChange} />}
        <MonsterAttributeFilter
          filters={filters}
          onChange={onChange}
          compact
          defaultOpen={openAll || section === "attribute"}
        />
        <MonsterRarityFilter
          filters={filters}
          onChange={onChange}
          compact
          defaultOpen={openAll || section === "rarity"}
        />
        <MonsterTypeFilter
          filters={filters}
          onChange={onChange}
          compact
          defaultOpen={openAll || section === "type"}
        />
      </div>
    </MobileSheet>
  );
}

function SheetResultsFooter({
  matchCount,
  loading,
  onClose,
}: {
  matchCount: number;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <p className="min-w-0 flex-1 text-[11px] leading-tight text-[var(--color-muted)]">
        Matching database
        <span className="block font-mono text-xs font-semibold text-[var(--color-fg-strong)]">
          {loading ? "Searching…" : `${matchCount.toLocaleString()} found`}
        </span>
      </p>
      <button
        type="button"
        onClick={onClose}
        className="ds-btn-primary pressable h-11 shrink-0 px-5 text-sm"
      >
        Show results
      </button>
    </>
  );
}

function MobileDisplayTabs({
  sections,
  onChange,
}: {
  sections: ResultDisplaySections;
  onChange: (next: ResultDisplaySections) => void;
}) {
  const activeTab = displayTabFromSections(sections);
  return (
    <div
      role="tablist"
      aria-label="Card content"
      className="mx-3 grid grid-cols-4 gap-0.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-inset)] p-0.5"
    >
      {RESULT_DISPLAY_TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(sectionsForDisplayTab(tab.id, sections))}
            className={`pressable min-h-8 rounded-lg text-[11px] font-semibold ${
              active
                ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)] shadow-[var(--shadow-glow)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-fg-strong)]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
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
        <SheetIconButton onClick={onToggleCollapsed} label="Expand details" expanded={false}>
          ‹
        </SheetIconButton>
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
        <SheetIconButton onClick={onToggleCollapsed} label="Collapse details" expanded>
          ›
        </SheetIconButton>
        <SheetIconButton onClick={onClose} label="Close details">
          ✕
        </SheetIconButton>
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

/**
 * Floating "Filters (n active)" button + the Leader / Active / Awakenings /
 * Text sheet (same content the former 4-button dock opened).
 */
function MobileSkillFilterFab({
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
  hidden,
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
  /** Another sheet is open — keep the FAB out of the way. */
  hidden: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SkillSheetMode>("leader_skill");
  const closeSheet = () => setOpen(false);

  const hasCd =
    skillFilters.activeCdMin != null || skillFilters.activeCdMax != null;
  const counts: Record<SkillSheetMode, number> = {
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
  const totalActive =
    counts.leader_skill + counts.active_skill + counts.awakening + counts.by_text;

  const resetMode = (target: SkillSheetMode) => {
    switch (target) {
      case "leader_skill":
      case "active_skill":
        // Dropping the chips also prunes their value / turn ranges (App).
        onSkillFiltersChange({
          ...skillFilters,
          selectedPatterns: skillFilters.selectedPatterns.filter(
            (p) => p.skillType !== target
          ),
          ...(target === "active_skill"
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
      <MobileSheet
        open={open}
        onClose={closeSheet}
        label={`${SKILL_SHEET_TITLES[mode]} filters`}
        title={
          <span className="flex items-center gap-2">
            {SKILL_SHEET_TITLES[mode]}
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-secondary)]/40 bg-[var(--color-secondary-muted)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-secondary-strong)]">
              <span
                aria-hidden
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-secondary)]"
              />
              Live
            </span>
          </span>
        }
        headerExtra={
          counts[mode] > 0 ? (
            <button
              type="button"
              onClick={() => resetMode(mode)}
              className="pressable inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--color-negative)] hover:bg-[var(--color-negative)]/10"
            >
              <span aria-hidden>↺</span>
              Reset
            </button>
          ) : null
        }
        subheader={
          <div
            role="tablist"
            aria-label="Filter groups"
            className="grid grid-cols-4 gap-1"
          >
            {SKILL_SHEET_TABS.map((tab) => {
              const active = mode === tab.mode;
              const count = counts[tab.mode];
              return (
                <button
                  key={tab.mode}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(tab.mode)}
                  className={`ds-pill pressable relative min-h-9 justify-center px-1 text-[11px] font-semibold ${
                    active ? "ds-pill-active" : ""
                  }`}
                >
                  <span aria-hidden className="font-mono text-xs leading-none">
                    {tab.glyph}
                  </span>
                  <span className="truncate">{tab.label}</span>
                  {count > 0 && (
                    <span className="absolute -top-1.5 right-1 min-w-4 rounded-full bg-[var(--color-secondary)] px-1 font-mono text-[9px] font-bold leading-4 tabular-nums text-slate-950 shadow-[var(--shadow-glow-cyan)]">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        }
        footer={<SheetResultsFooter matchCount={matchCount} loading={loading} onClose={closeSheet} />}
      >
        {mode === "awakening" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            <MonsterAwakeningFilter
              filters={monsterFilters}
              onChange={onMonsterFiltersChange}
              compact
            />
          </div>
        ) : mode === "by_text" ? (
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
              {patternGroups && mode === "leader_skill" && (
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
              {patternGroups && mode === "active_skill" && (
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
      </MobileSheet>

      {!open && !hidden && (
        <div className={`pointer-events-none fixed right-3 z-30 ${MOBILE_FAB_BOTTOM_CLASS}`}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={`glass-bar pressable pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-[var(--shadow-float)] ${
              totalActive > 0
                ? "border-[var(--color-accent)]/60 text-[var(--color-accent-strong)]"
                : "border-white/10 text-[var(--color-fg-strong)]"
            }`}
          >
            <SlidersIcon className="h-4 w-4" />
            <span>
              Filters
              {totalActive > 0 && (
                <span className="font-mono tabular-nums"> ({totalActive} active)</span>
              )}
            </span>
          </button>
        </div>
      )}
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
  teamDraft,
  monsterSheet,
  onMonsterSheetChange,
}: Props) {
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const showDetail = selected != null;

  const handleSelect = (row: MonsterRecord | null) => {
    onSelect(row);
    if (row) setDetailCollapsed(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <section className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="px-3 pt-2 pb-2">
          <MonsterIdSearchInput
            filters={monsterFilters}
            onChange={onMonsterFiltersChange}
          />
        </div>
        <MobileQuickChipRow filters={monsterFilters} onOpen={onMonsterSheetChange} />
      </section>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 space-y-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] pt-2 pb-1.5">
          <MobileDisplayTabs
            sections={displaySections}
            onChange={onDisplaySectionsChange}
          />
          <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <p
              className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--color-muted)]"
              aria-live="polite"
            >
              {loading ? (
                `Loading… ${loadProgress ?? 0}`
              ) : (
                <>
                  <span aria-hidden className="text-[var(--color-positive)]">
                    ●{" "}
                  </span>
                  <span className="text-[var(--color-accent-strong)]">
                    {rows.length.toLocaleString()}
                  </span>
                  {` monster${rows.length === 1 ? "" : "s"} matched`}
                  {rows.length !== totalLoaded && ` · ${totalLoaded.toLocaleString()} loaded`}
                </>
              )}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
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
            </div>
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
              teamDraft={teamDraft}
            />
            {teamDraft && (
              <TeamDraftDock
                draft={teamDraft.draft}
                onClear={teamDraft.onClear}
                compact
              />
            )}
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

      <MobileMonsterFilterSheet
        section={monsterSheet}
        filters={monsterFilters}
        onChange={onMonsterFiltersChange}
        onClose={() => onMonsterSheetChange(null)}
        matchCount={rows.length}
        loading={loading}
      />

      <MobileSkillFilterFab
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
        hidden={monsterSheet != null}
      />
    </div>
  );
}
