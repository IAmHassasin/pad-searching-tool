import type { MonsterFilters } from "../types";
import {
  MonsterActiveFilterChips,
  MonsterAttributeFilter,
  MonsterFilterClearButton,
  MonsterIdFilter,
  MonsterRarityFilter,
  MonsterStatsFilter,
  hasActiveMonsterFilters,
} from "./filters/monster-filter-shared";

type Props = {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
};

export function MonsterFilterPanel({ filters, onChange }: Props) {
  const active = hasActiveMonsterFilters(filters);

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)]">
        Monster
      </h2>

      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] text-[var(--color-muted)]/80">
          Tap chips to filter stats & attributes
        </p>
        {active && <MonsterFilterClearButton filters={filters} onChange={onChange} />}
      </div>

      <MonsterActiveFilterChips filters={filters} onChange={onChange} />
      <MonsterRarityFilter filters={filters} onChange={onChange} />
      <MonsterAttributeFilter filters={filters} onChange={onChange} />
      <MonsterStatsFilter filters={filters} onChange={onChange} />
      <MonsterIdFilter filters={filters} onChange={onChange} />
    </aside>
  );
}
