import { EffectFilterSpriteIcon } from "../EffectFilterSpriteIcon";
import { hasEffectFilterIcon } from "../../lib/effect-filter-sprite";
import type { PatternGroupsManifest, SkillFilters } from "../../types";
import { CollapsibleFilterSection } from "./collapsible-filter-section";

export function tagKey(tag: {
  tag_id: number | null;
  tag_name_en: string;
}): string {
  return tag.tag_id != null ? String(tag.tag_id) : tag.tag_name_en;
}

export const CATEGORY_ACCENT: Record<string, string> = {
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

export function PatternTagChip({
  label,
  count,
  selected,
  disabled,
  accent,
  onToggle,
  compact = false,
}: {
  label: string;
  count: number;
  selected: boolean;
  disabled: boolean;
  accent: string;
  onToggle: () => void;
  compact?: boolean;
}) {
  const hasIcon = hasEffectFilterIcon(label);
  const iconSize = compact ? 26 : 30;
  const tooltip = disabled
    ? "No regex patterns loaded for this tag"
    : count > 0
      ? `${label} — ${count} pattern(s)`
      : label;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      title={tooltip}
      aria-label={label}
      className={`group inline-flex max-w-full items-center gap-1 rounded-md border text-left transition-colors ${
        hasIcon
          ? compact
            ? "p-0.5"
            : "p-1"
          : compact
            ? "px-1.5 py-0.5 text-[10px] leading-tight"
            : "px-2 py-1 text-[11px] leading-tight"
      } ${
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
      {hasIcon ? (
        <EffectFilterSpriteIcon
          label={label}
          size={iconSize}
          className={selected ? "ring-1 ring-[var(--color-accent)]/70" : ""}
        />
      ) : (
        <>
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          <span className="min-w-0 truncate">{label}</span>
        </>
      )}
      {count > 0 && !hasIcon && (
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

export function PatternMatchToggle({
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

export function SkillPatternGroup({
  title,
  skillType,
  categories,
  filters,
  onChange,
  compact = false,
  iconOnly = false,
  showAdvancedToggle = false,
  defaultOpen,
}: {
  title: string;
  skillType: "active_skill" | "leader_skill";
  categories: PatternGroupsManifest["active_skill_filters"];
  filters: SkillFilters;
  onChange: (next: SkillFilters) => void;
  compact?: boolean;
  /** When true, only show filters that have effect icons. */
  iconOnly?: boolean;
  /** Desktop active-skill: show advanced-filters checkbox. */
  showAdvancedToggle?: boolean;
  defaultOpen?: boolean;
}) {
  if (!categories.length) return null;

  const isSelected = (key: string) =>
    filters.selectedPatterns.some(
      (s) => s.skillType === skillType && s.tagKey === key
    );

  const toggleTag = (key: string, label: string) => {
    if (isSelected(key)) {
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

  const visibleCategories = categories
    .map((cat) => ({
      ...cat,
      tags: iconOnly
        ? cat.tags.filter((tag) => hasEffectFilterIcon(tag.label))
        : cat.tags,
    }))
    .filter((cat) => cat.tags.length > 0);

  if (iconOnly && visibleCategories.length === 0) return null;

  const totalTags = visibleCategories.reduce((n, c) => n + c.tags.length, 0);
  const selectedInGroup = filters.selectedPatterns.filter(
    (s) => s.skillType === skillType
  ).length;
  const summary =
    selectedInGroup > 0
      ? `${selectedInGroup} / ${totalTags} selected`
      : `${totalTags} tags`;

  const sectionDefaultOpen =
    defaultOpen ?? selectedInGroup > 0;

  return (
    <CollapsibleFilterSection
      title={title}
      summary={summary}
      compact={compact}
      defaultOpen={sectionDefaultOpen}
      headerExtra={
        showAdvancedToggle ? (
          <label
            className={`flex shrink-0 cursor-pointer items-center gap-1 text-[var(--color-muted)] ${
              compact ? "text-[9px]" : "text-[10px]"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={filters.activeSkillAdvancedFilters}
              onChange={(e) =>
                onChange({
                  ...filters,
                  activeSkillAdvancedFilters: e.target.checked,
                })
              }
              className="accent-[var(--color-accent)]"
            />
            Advanced
          </label>
        ) : undefined
      }
    >
      <div className={`space-y-3 ${compact ? "" : ""}`}>
        {visibleCategories.map((cat) => {
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
              <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-1.5"}`}>
                {cat.tags.map((tag) => {
                  const key = tagKey(tag);
                  const count = tag.patternCount ?? 0;
                  return (
                    <PatternTagChip
                      key={`${skillType}-${key}`}
                      label={tag.label}
                      count={count}
                      selected={isSelected(key)}
                      disabled={count === 0}
                      accent={accent}
                      compact={compact}
                      onToggle={() => toggleTag(key, tag.label)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleFilterSection>
  );
}

export function SkillPatternSelectionBar({
  filters,
  onChange,
  compact = false,
}: {
  filters: SkillFilters;
  onChange: (next: SkillFilters) => void;
  compact?: boolean;
}) {
  const clearPatterns = () => {
    onChange({ ...filters, selectedPatterns: [] });
  };

  return (
    <div
      className={`shrink-0 border-b border-[var(--color-border)] bg-[var(--color-panel)] ${
        compact ? "px-0 pb-2" : "pb-2"
      }`}
    >
      {filters.selectedPatterns.length > 0 && (
        <div
          className={`mb-1.5 flex items-center justify-end ${
            compact ? "" : "gap-2"
          }`}
        >
          <button
            type="button"
            onClick={clearPatterns}
            className={`shrink-0 rounded border border-[var(--color-border)] text-[var(--color-muted)] hover:border-red-500/50 hover:text-red-300 ${
              compact ? "px-2 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10px]"
            }`}
          >
            Clear all
          </button>
        </div>
      )}
      <SkillSelectedPatternChips filters={filters} onChange={onChange} />
      <PatternMatchToggle
        value={filters.patternMatch}
        onChange={(patternMatch) => onChange({ ...filters, patternMatch })}
      />
    </div>
  );
}

export function SkillSelectedPatternChips({
  filters,
  onChange,
}: {
  filters: SkillFilters;
  onChange: (next: SkillFilters) => void;
}) {
  if (filters.selectedPatterns.length === 0) return null;

  const toggleTag = (
    skillType: "active_skill" | "leader_skill",
    key: string,
    label: string
  ) => {
    const isSelected = filters.selectedPatterns.some(
      (s) => s.skillType === skillType && s.tagKey === key
    );
    if (isSelected) {
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

  return (
    <div className="mb-2 flex flex-wrap gap-1">
      {filters.selectedPatterns.map((p) => {
        const label = p.label ?? p.tagKey;
        const hasIcon = hasEffectFilterIcon(label);
        return (
          <button
            key={`${p.skillType}-${p.tagKey}`}
            type="button"
            onClick={() => toggleTag(p.skillType, p.tagKey, label)}
            className={`inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/50 bg-[#1f3a5f] ${
              hasIcon ? "p-0.5" : "px-2 py-0.5 text-[10px] text-[var(--color-accent)]"
            } hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-300`}
            title={`${label} — click to remove`}
            aria-label={`Remove ${label}`}
          >
            {hasIcon ? (
              <EffectFilterSpriteIcon label={label} size={22} />
            ) : (
              label
            )}
            <span aria-hidden className={hasIcon ? "pr-1 text-[10px]" : ""}>
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SkillTextSearchSection({
  filters,
  onChange,
  compact = false,
}: {
  filters: SkillFilters;
  onChange: (next: SkillFilters) => void;
  compact?: boolean;
}) {
  const activeFields = [
    filters.activeSkillText.trim(),
    filters.leaderSkillText.trim(),
  ].filter(Boolean).length;

  return (
    <CollapsibleFilterSection
      title="Skill text search"
      summary={
        activeFields > 0
          ? `${activeFields} field${activeFields === 1 ? "" : "s"} active`
          : "substring filter"
      }
      compact={compact}
      defaultOpen={activeFields > 0}
    >
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
    </CollapsibleFilterSection>
  );
}
