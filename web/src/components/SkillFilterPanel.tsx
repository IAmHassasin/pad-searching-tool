import type { PatternGroupsManifest, SkillFilters } from "../types";

type Props = {
  filters: SkillFilters;
  onChange: (next: SkillFilters) => void;
  patternGroups: PatternGroupsManifest | undefined;
  patternGroupsLoading: boolean;
};

function tagKey(tag: { tag_id: number | null; tag_name_en: string }): string {
  return tag.tag_id != null ? String(tag.tag_id) : tag.tag_name_en;
}

export function SkillFilterPanel({
  filters,
  onChange,
  patternGroups,
  patternGroupsLoading,
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

  const renderGroup = (
    title: string,
    skillType: "active_skill" | "leader_skill",
    categories: PatternGroupsManifest["active_skill_filters"]
  ) => {
    if (!categories.length) return null;
    return (
      <section>
        <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">
          {title}
        </p>
        <div className="max-h-56 space-y-2 overflow-y-auto rounded border border-[var(--color-border)] bg-[#0d1117] p-2">
          {categories.map((cat) => (
            <div key={cat.category_id}>
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                {cat.category_name}
              </p>
              <ul className="space-y-0.5">
                {cat.tags.map((tag) => {
                  const key = tagKey(tag);
                  const count = tag.patternCount ?? 0;
                  return (
                    <li key={`${skillType}-${key}`}>
                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-[#21262d] has-[:checked]:bg-[#1f3a5f] ${count === 0 ? "opacity-50" : ""}`}
                        title={
                          count === 0
                            ? "No regex patterns loaded for this tag"
                            : `${count} regex pattern(s)`
                        }
                      >
                        <input
                          type="checkbox"
                          disabled={count === 0}
                          checked={isSelected(skillType, key)}
                          onChange={() =>
                            toggleTag(skillType, key, tag.label)
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {tag.label}
                        </span>
                        <span className="shrink-0 text-[var(--color-muted)]">
                          {count}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <aside className="flex h-full flex-col gap-3 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)]">
        Skill patterns
      </h2>

      <section>
        <p className="mb-1 text-xs text-[var(--color-muted)]">
          Regex patterns (queried in SQLite)
        </p>
        {patternGroupsLoading && (
          <p className="text-xs text-[var(--color-muted)]">Loading groups…</p>
        )}
        {filters.selectedPatterns.length > 0 && (
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            {filters.selectedPatterns.length} pattern tag(s) selected
          </p>
        )}
        <div className="mb-2 flex gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="patternMode"
              checked={filters.patternMatch === "any"}
              onChange={() =>
                onChange({ ...filters, patternMatch: "any" })
              }
            />
            Match any tag
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="patternMode"
              checked={filters.patternMatch === "all"}
              onChange={() =>
                onChange({ ...filters, patternMatch: "all" })
              }
            />
            Match all tags
          </label>
        </div>
        {patternGroups && (
          <>
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
          </>
        )}
      </section>

      <section>
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
