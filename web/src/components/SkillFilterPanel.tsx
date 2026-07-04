import type { PatternGroupsManifest, SkillFilters } from "../types";
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
  open: boolean;
  onToggle: () => void;
};

function PanelToggleButton({
  open,
  onToggle,
  className = "",
}: {
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={open ? "Collapse skill filters" : "Expand skill filters"}
      aria-expanded={open}
      aria-label={open ? "Collapse skill filters" : "Expand skill filters"}
      className={`flex shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-[#0d1117] text-[var(--color-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-white ${className}`}
    >
      <span aria-hidden className="text-sm leading-none">
        {open ? "›" : "‹"}
      </span>
    </button>
  );
}

export function SkillFilterPanel({
  filters,
  onChange,
  patternGroups,
  patternGroupsLoading,
  open,
  onToggle,
}: Props) {
  if (!open) {
    return (
      <aside className="flex h-full w-10 shrink-0 flex-col items-center border-l border-[var(--color-border)] bg-[var(--color-panel)] py-3">
        <PanelToggleButton
          open={open}
          onToggle={onToggle}
          className="h-8 w-8"
        />
        <span
          className="mt-3 text-[10px] font-semibold tracking-wide text-[var(--color-muted)] [writing-mode:vertical-rl]"
        >
          Skills
        </span>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)]">
          Skill patterns
        </h2>
        <PanelToggleButton
          open={open}
          onToggle={onToggle}
          className="h-7 w-7"
        />
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

        <SkillTextSearchSection filters={filters} onChange={onChange} />
      </div>
    </aside>
  );
}
