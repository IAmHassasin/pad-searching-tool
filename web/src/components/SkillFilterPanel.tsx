import type {
  AdvancedEffectFilters,
  EffectFamilyDef,
  PatternGroupsManifest,
  SkillFilters,
} from "../types";
import { useResizablePanel } from "../hooks/useResizablePanel";
import { ResizableSidePanel } from "./ResizableSidePanel";
import { AdvancedEffectFilterSection } from "./filters/advanced-effect-filter";
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
  effectFamiliesLoading: boolean;
};

export function SkillFilterPanel({
  filters,
  onChange,
  patternGroups,
  patternGroupsLoading,
  advancedEffectFilters,
  onAdvancedEffectFiltersChange,
  effectFamilies,
  effectFamiliesLoading,
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
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)] [font-family:var(--font-mono)]">
            Skill patterns
          </h2>
          <button
            type="button"
            onClick={panel.toggleCollapsed}
            title="Collapse skill filters"
            aria-label="Collapse skill filters"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-inset)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-white"
          >
            <span aria-hidden className="text-sm leading-none">
              ›
            </span>
          </button>
        </div>

        <div className="shrink-0 px-3 pt-2">
          {patternGroupsLoading && (
            <p className="mb-2 text-xs text-[var(--color-muted)]">
              Loading groups…
            </p>
          )}
          <SkillPatternSelectionBar filters={filters} onChange={onChange} />
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
              />
              <SkillPatternGroup
                title="Leader skill"
                skillType="leader_skill"
                categories={patternGroups.leader_skill_filters}
                filters={filters}
                onChange={onChange}
              />
            </div>
          )}

          <div className="mt-2 space-y-2">
            <AdvancedEffectFilterSection
              filters={advancedEffectFilters}
              onChange={onAdvancedEffectFiltersChange}
              families={effectFamilies}
              loading={effectFamiliesLoading}
            />
            <SkillTextSearchSection filters={filters} onChange={onChange} />
          </div>
        </div>
      </div>
    </ResizableSidePanel>
  );
}
