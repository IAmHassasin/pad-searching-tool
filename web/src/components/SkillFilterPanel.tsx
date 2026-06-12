import type { PatternGroupsManifest, SkillFilters } from "../types";
import {
  PatternMatchToggle,
  SkillPatternGroup,
  SkillSelectedPatternChips,
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
  const clearPatterns = () => {
    onChange({ ...filters, selectedPatterns: [] });
  };

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
    <aside className="flex h-full min-w-0 flex-col gap-4 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)]">
          Skill patterns
        </h2>
        <PanelToggleButton
          open={open}
          onToggle={onToggle}
          className="h-7 w-7"
        />
      </div>

      <section>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-[var(--color-muted)]">
              Regex pattern tags
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--color-muted)]/80">
              Tap chips to filter — all tags visible below
            </p>
          </div>
          {filters.selectedPatterns.length > 0 && (
            <button
              type="button"
              onClick={clearPatterns}
              className="shrink-0 rounded border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)] hover:border-red-500/50 hover:text-red-300"
            >
              Clear all
            </button>
          )}
        </div>

        {patternGroupsLoading && (
          <p className="text-xs text-[var(--color-muted)]">Loading groups…</p>
        )}

        <SkillSelectedPatternChips filters={filters} onChange={onChange} />

        <PatternMatchToggle
          value={filters.patternMatch}
          onChange={(patternMatch) => onChange({ ...filters, patternMatch })}
        />

        {patternGroups && (
          <div className="space-y-4">
            <SkillPatternGroup
              title="Active skill"
              skillType="active_skill"
              categories={patternGroups.active_skill_filters}
              filters={filters}
              onChange={onChange}
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
      </section>

      <SkillTextSearchSection filters={filters} onChange={onChange} />
    </aside>
  );
}
