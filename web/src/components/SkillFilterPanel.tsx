import type {
  AdvancedEffectFilters,
  EffectFamilyDef,
  PatternGroupsManifest,
  SkillFilters,
} from "../types";
import { countAdvancedEffectFilters } from "../types";
import { useResizablePanel } from "../hooks/useResizablePanel";
import { ResizableSidePanel } from "./ResizableSidePanel";
import {
  ActiveSkillCooldownField,
  SelectedEffectTuning,
  UnscopedEffectRangeChips,
} from "./filters/effect-tuning";
import {
  SkillPatternGroup,
  SkillPatternSelectionBar,
  SkillTextSearchSection,
} from "./filters/skill-pattern-shared";

type Props = {
  filters: SkillFilters;
  onChange: (next: SkillFilters) => void;
  patternGroups: PatternGroupsManifest | undefined;
  patternGroupsLoading: boolean;
  advancedEffectFilters: AdvancedEffectFilters;
  onAdvancedEffectFiltersChange: (next: AdvancedEffectFilters) => void;
  effectFamilies: EffectFamilyDef[] | undefined;
};

export function SkillFilterPanel({
  filters,
  onChange,
  patternGroups,
  patternGroupsLoading,
  advancedEffectFilters,
  onAdvancedEffectFiltersChange,
  effectFamilies,
}: Props) {
  const panel = useResizablePanel({
    storageKey: "skill",
    side: "right",
    defaultWidth: 320,
    minWidth: 280,
    maxWidth: 600,
  });

  return (
    <ResizableSidePanel
      side="right"
      collapsed={panel.collapsed}
      width={panel.width}
      dragHandleProps={panel.dragHandleProps}
      collapsedLabel="Skills"
      onExpandToggle={panel.toggleCollapsed}
      ariaLabel="skill filters"
    >
      <div className="flex h-full min-w-0 flex-col overflow-hidden">
        <div className="glass-bar flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
          <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[var(--color-fg-strong)]">
            <span
              aria-hidden
              className="h-3.5 w-1 rounded-full bg-[var(--color-secondary)] shadow-[var(--shadow-glow-cyan)]"
            />
            Skill patterns
          </h2>
          <button
            type="button"
            onClick={panel.toggleCollapsed}
            title="Collapse skill filters"
            aria-label="Collapse skill filters"
            className="pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white/5 text-[var(--color-muted)] hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-accent-muted)] hover:text-[var(--color-accent-strong)]"
          >
            <span aria-hidden className="text-sm leading-none">
              ›
            </span>
          </button>
        </div>

        <div className="shrink-0 px-3 pt-2">
          {patternGroupsLoading && (
            <p className="mb-2 animate-pulse text-xs text-[var(--color-muted)]">
              Loading groups…
            </p>
          )}
          <SkillPatternSelectionBar filters={filters} onChange={onChange} />
          <UnscopedEffectRangeChips
            effectFilters={advancedEffectFilters}
            onEffectFiltersChange={onAdvancedEffectFiltersChange}
            families={effectFamilies}
            selectedPatterns={filters.selectedPatterns}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {patternGroups && (
            <div className="space-y-2">
              <SkillPatternGroup
                title="Active skill"
                skillType="active_skill"
                categories={patternGroups.active_skill_filters}
                filters={filters}
                onChange={onChange}
                iconOnly={!filters.activeSkillAdvancedFilters}
                showAdvancedToggle
                extraActiveCount={
                  (filters.activeCdMin != null || filters.activeCdMax != null
                    ? 1
                    : 0) +
                  countAdvancedEffectFilters(advancedEffectFilters, "active_skill")
                }
                beforeTags={
                  <ActiveSkillCooldownField filters={filters} onChange={onChange} />
                }
                afterTags={
                  <SelectedEffectTuning
                    skillType="active_skill"
                    skillFilters={filters}
                    effectFilters={advancedEffectFilters}
                    onEffectFiltersChange={onAdvancedEffectFiltersChange}
                    families={effectFamilies}
                  />
                }
              />
              <SkillPatternGroup
                title="Leader skill"
                skillType="leader_skill"
                categories={patternGroups.leader_skill_filters}
                filters={filters}
                onChange={onChange}
                extraActiveCount={countAdvancedEffectFilters(
                  advancedEffectFilters,
                  "leader_skill"
                )}
                afterTags={
                  <SelectedEffectTuning
                    skillType="leader_skill"
                    skillFilters={filters}
                    effectFilters={advancedEffectFilters}
                    onEffectFiltersChange={onAdvancedEffectFiltersChange}
                    families={effectFamilies}
                  />
                }
              />
            </div>
          )}

          <div className="mt-2 space-y-2">
            <SkillTextSearchSection filters={filters} onChange={onChange} />
          </div>
        </div>
      </div>
    </ResizableSidePanel>
  );
}
