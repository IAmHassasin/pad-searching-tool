import type { MonsterFilters } from "../types";
import {
  MonsterActiveFilterChips,
  MonsterAttributeFilter,
  MonsterTypeFilter,
  MonsterFilterClearButton,
  MonsterIdFilter,
  MonsterRarityFilter,
  MonsterStatsFilter,
  hasActiveMonsterFilters,
} from "./filters/monster-filter-shared";
import { MonsterAwakeningFilter } from "./filters/awakening-filter-shared";

type Props = {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
};

export function MonsterFilterPanel({ filters, onChange }: Props) {
  const active = hasActiveMonsterFilters(filters);

  return (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <div className="shrink-0 space-y-4">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)]">
          Monster
        </h2>

        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] text-[var(--color-muted)]/80">
            Tap chips to filter stats & attributes
          </p>
          {active && (
            <MonsterFilterClearButton filters={filters} onChange={onChange} />
          )}
        </div>

        <MonsterActiveFilterChips filters={filters} onChange={onChange} />
        <MonsterRarityFilter filters={filters} onChange={onChange} />
        <MonsterAttributeFilter filters={filters} onChange={onChange} />
        <MonsterTypeFilter filters={filters} onChange={onChange} />
        <MonsterStatsFilter filters={filters} onChange={onChange} />
        <MonsterIdFilter filters={filters} onChange={onChange} />
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <MonsterAwakeningFilter
          filters={filters}
          onChange={onChange}
          fillHeight
        />
      </div>
    </aside>
  );
}
