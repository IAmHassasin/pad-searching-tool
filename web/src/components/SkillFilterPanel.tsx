import type { PatternGroupsManifest, SkillFilters } from "../types";

type Props = {
  filters: SkillFilters;
  onChange: (next: SkillFilters) => void;
  patternGroups: PatternGroupsManifest | undefined;
  patternGroupsLoading: boolean;
  open: boolean;
  onToggle: () => void;
};

function tagKey(tag: { tag_id: number | null; tag_name_en: string }): string {
  return tag.tag_id != null ? String(tag.tag_id) : tag.tag_name_en;
}

const CATEGORY_ACCENT: Record<string, string> = {
  as_offensive_damage: "#f85149",
  as_buffs_caps: "#d29922",
  as_mechanics_utility: "#a371f7",
  as_recovery: "#3fb950",
  as_orb_manipulation: "#39c5cf",
  ls_stat_multipliers: "#58a6ff",
  ls_condition_buffs: "#db6d28",
  ls_extra_effects: "#f778ba",
  ls_restrictions_board: "#8b949e",
};

function PatternTagChip({
  label,
  count,
  selected,
  disabled,
  accent,
  onToggle,
}: {
  label: string;
  count: number;
  selected: boolean;
  disabled: boolean;
  accent: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      title={
        disabled
          ? "No regex patterns loaded for this tag"
          : `${count} regex pattern(s)`
      }
      className={`group inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-left text-[11px] leading-tight transition-colors ${
        disabled
          ? "cursor-not-allowed border-[var(--color-border)]/50 text-[var(--color-muted)] opacity-40"
          : selected
            ? "border-[var(--color-accent)] bg-[#1f3a5f] text-white shadow-[inset_0_0_0_1px_rgba(88,166,255,0.25)]"
            : "border-[var(--color-border)] bg-[#0d1117] text-[#c9d1d9] hover:border-[var(--color-accent)]/60 hover:bg-[#21262d]"
      }`}
      style={
        selected && !disabled
          ? { boxShadow: `inset 3px 0 0 0 ${accent}` }
          : undefined
      }
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <span className="min-w-0 truncate">{label}</span>
      {count > 0 && (
        <span
          className={`shrink-0 rounded px-1 py-px text-[9px] font-medium tabular-nums ${
            selected
              ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
              : "bg-[#21262d] text-[var(--color-muted)]"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function PatternMatchToggle({
  value,
  onChange,
}: {
  value: SkillFilters["patternMatch"];
  onChange: (mode: SkillFilters["patternMatch"]) => void;
}) {
  return (
    <div
      className="mb-3 flex rounded-lg border border-[var(--color-border)] bg-[#0d1117] p-0.5"
      role="radiogroup"
      aria-label="Pattern match mode"
    >
      {(
        [
          { id: "any" as const, label: "Match any" },
          { id: "all" as const, label: "Match all" },
        ] as const
      ).map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            value === id
              ? "bg-[var(--color-accent)] text-[#0d1117]"
              : "text-[var(--color-muted)] hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

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
  const isSelected = (
    skillType: "active_skill" | "leader_skill",
    key: string
  ) =>
    filters.selectedPatterns.some(
      (s) => s.skillType === skillType && s.tagKey === key
    );

  const toggleTag = (
    skillType: "active_skill" | "leader_skill",
    key: string,
    label: string
  ) => {
    if (isSelected(skillType, key)) {
      onChange({
        ...filters,
        selectedPatterns: filters.selectedPatterns.filter(
          (s) => !(s.skillType === skillType && s.tagKey === key)
        ),
      });
    } else {
      onChange({
        ...filters,
        selectedPatterns: [
          ...filters.selectedPatterns,
          { skillType, tagKey: key, label },
        ],
      });
    }
  };

  const clearPatterns = () => {
    onChange({ ...filters, selectedPatterns: [] });
  };

  const renderGroup = (
    title: string,
    skillType: "active_skill" | "leader_skill",
    categories: PatternGroupsManifest["active_skill_filters"]
  ) => {
    if (!categories.length) return null;
    const totalTags = categories.reduce((n, c) => n + c.tags.length, 0);
    const selectedInGroup = filters.selectedPatterns.filter(
      (s) => s.skillType === skillType
    ).length;

    return (
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold text-white">{title}</p>
          <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
            {selectedInGroup > 0
              ? `${selectedInGroup} / ${totalTags} selected`
              : `${totalTags} tags`}
          </span>
        </div>
        <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[#0d1117]/60 p-2.5">
          {categories.map((cat) => {
            const accent =
              CATEGORY_ACCENT[cat.category_id] ?? "var(--color-accent)";
            return (
              <div key={cat.category_id}>
                <p
                  className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]"
                  style={{ color: accent }}
                >
                  <span
                    className="h-px w-2 shrink-0"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                  {cat.category_name}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {cat.tags.map((tag) => {
                    const key = tagKey(tag);
                    const count = tag.patternCount ?? 0;
                    return (
                      <PatternTagChip
                        key={`${skillType}-${key}`}
                        label={tag.label}
                        count={count}
                        selected={isSelected(skillType, key)}
                        disabled={count === 0}
                        accent={accent}
                        onToggle={() =>
                          toggleTag(skillType, key, tag.label)
                        }
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
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

        {filters.selectedPatterns.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {filters.selectedPatterns.map((p) => (
              <button
                key={`${p.skillType}-${p.tagKey}`}
                type="button"
                onClick={() =>
                  toggleTag(p.skillType, p.tagKey, p.label ?? p.tagKey)
                }
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/50 bg-[#1f3a5f] px-2 py-0.5 text-[10px] text-[var(--color-accent)] hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-300"
                title="Click to remove"
              >
                {p.label ?? p.tagKey}
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        )}

        <PatternMatchToggle
          value={filters.patternMatch}
          onChange={(patternMatch) => onChange({ ...filters, patternMatch })}
        />

        {patternGroups && (
          <div className="space-y-4">
            {renderGroup(
              "Active skill",
              "active_skill",
              patternGroups.active_skill_filters
            )}
            {renderGroup(
              "Leader skill",
              "leader_skill",
              patternGroups.leader_skill_filters
            )}
          </div>
        )}
      </section>

      <section className="border-t border-[var(--color-border)] pt-3">
        <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">
          Skill text search (additional)
        </p>
        <select
          className="mb-2 w-full rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1 text-xs"
          value={filters.skillTextMode}
          onChange={(e) =>
            onChange({
              ...filters,
              skillTextMode: e.target.value as SkillFilters["skillTextMode"],
            })
          }
        >
          <option value="both">Active + leader (both must match)</option>
          <option value="active">Active only</option>
          <option value="leader">Leader only</option>
        </select>
        <label className="mb-2 flex flex-col gap-0.5 text-xs text-[var(--color-muted)]">
          Active skill description
          <textarea
            rows={3}
            className="resize-y rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1 text-sm text-white"
            value={filters.activeSkillText}
            onChange={(e) =>
              onChange({ ...filters, activeSkillText: e.target.value })
            }
            placeholder="Substring filter (AND with patterns)…"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-[var(--color-muted)]">
          Leader skill description
          <textarea
            rows={3}
            className="resize-y rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1 text-sm text-white"
            value={filters.leaderSkillText}
            onChange={(e) =>
              onChange({ ...filters, leaderSkillText: e.target.value })
            }
            placeholder="Substring filter (AND with patterns)…"
          />
        </label>
      </section>
    </aside>
  );
}
