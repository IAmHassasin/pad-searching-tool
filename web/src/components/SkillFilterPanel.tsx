import type { CategoryBundleIndex, SkillFilters } from "../types";

type Props = {
  filters: SkillFilters;
  onChange: (next: SkillFilters) => void;
  bundleIndex: CategoryBundleIndex | undefined;
  bundleIndexLoading: boolean;
  loadedBundleCount: number;
};

export function SkillFilterPanel({
  filters,
  onChange,
  bundleIndex,
  bundleIndexLoading,
  loadedBundleCount,
}: Props) {
  const files = bundleIndex?.files ?? [];
  const asFiles = files.filter((f) => f.category.startsWith("AS "));
  const lsFiles = files.filter((f) => f.category.startsWith("LS "));
  const otherFiles = files.filter(
    (f) => !f.category.startsWith("AS ") && !f.category.startsWith("LS ")
  );

  const isSelected = (file: string) =>
    filters.selectedCategories.some((s) => s.file === file);

  const toggleCategory = (category: string, file: string) => {
    if (isSelected(file)) {
      onChange({
        ...filters,
        selectedCategories: filters.selectedCategories.filter(
          (s) => s.file !== file
        ),
      });
    } else {
      onChange({
        ...filters,
        selectedCategories: [
          ...filters.selectedCategories,
          { category, file },
        ],
      });
    }
  };

  const renderGroup = (
    title: string,
    items: CategoryBundleIndex["files"]
  ) => {
    if (!items.length) return null;
    return (
      <section>
        <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">
          {title}
        </p>
        <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded border border-[var(--color-border)] bg-[#0d1117] p-1">
          {items.map((item) => (
            <li key={item.file}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-[#21262d] has-[:checked]:bg-[#1f3a5f]">
                <input
                  type="checkbox"
                  checked={isSelected(item.file)}
                  onChange={() => toggleCategory(item.category, item.file)}
                />
                <span className="min-w-0 flex-1 truncate">{item.category}</span>
                <span className="shrink-0 text-[var(--color-muted)]">
                  {item.count}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <aside className="flex h-full flex-col gap-3 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)]">
        Skill / category
      </h2>

      <section>
        <p className="mb-1 text-xs text-[var(--color-muted)]">
          Category bundles (cached client-side)
        </p>
        {bundleIndexLoading && (
          <p className="text-xs text-[var(--color-muted)]">Loading index…</p>
        )}
        {filters.selectedCategories.length > 0 && (
          <p className="text-xs text-[var(--color-muted)]">
            {loadedBundleCount}/{filters.selectedCategories.length} bundles
            loaded
          </p>
        )}
        <div className="mb-2 flex gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="catMode"
              checked={filters.categoryMatch === "any"}
              onChange={() =>
                onChange({ ...filters, categoryMatch: "any" })
              }
            />
            Any category
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="catMode"
              checked={filters.categoryMatch === "all"}
              onChange={() =>
                onChange({ ...filters, categoryMatch: "all" })
              }
            />
            All categories
          </label>
        </div>
        {renderGroup("Active skill", asFiles)}
        {renderGroup("Leader skill", lsFiles)}
        {renderGroup("Other", otherFiles)}
      </section>

      <section>
        <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">
          Skill text search
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
            placeholder="Substring search…"
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
            placeholder="Substring search…"
          />
        </label>
      </section>
    </aside>
  );
}
