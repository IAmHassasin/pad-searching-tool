import { useState } from "react";
import type { MonsterFilters } from "../types";
import { useCompactFilterLayout } from "../hooks/useCompactFilterLayout";
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

type MonsterFilterSection =
  | "rarity"
  | "attribute"
  | "type"
  | "stats"
  | "id"
  | "awakening";

const MONSTER_FILTER_SECTIONS: {
  id: MonsterFilterSection;
  label: string;
}[] = [
  { id: "rarity", label: "R★" },
  { id: "attribute", label: "Attr" },
  { id: "type", label: "Type" },
  { id: "stats", label: "Stats" },
  { id: "id", label: "ID" },
  { id: "awakening", label: "Awk" },
];

function FilterSectionTabBar({
  sections,
  active,
  onChange,
}: {
  sections: typeof MONSTER_FILTER_SECTIONS;
  active: MonsterFilterSection;
  onChange: (id: MonsterFilterSection) => void;
}) {
  return (
    <div
      className="flex shrink-0 flex-wrap gap-0.5"
      role="tablist"
      aria-label="Monster filter sections"
    >
      {sections.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          onClick={() => onChange(id)}
          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
            active === id
              ? "border-[var(--color-accent)] bg-[#1f3a5f] text-[var(--color-accent)]"
              : "border-[var(--color-border)] bg-[#0d1117] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MonsterFilterSectionContent({
  section,
  filters,
  onChange,
}: {
  section: MonsterFilterSection;
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
}) {
  switch (section) {
    case "rarity":
      return <MonsterRarityFilter filters={filters} onChange={onChange} />;
    case "attribute":
      return <MonsterAttributeFilter filters={filters} onChange={onChange} />;
    case "type":
      return <MonsterTypeFilter filters={filters} onChange={onChange} />;
    case "stats":
      return <MonsterStatsFilter filters={filters} onChange={onChange} />;
    case "id":
      return <MonsterIdFilter filters={filters} onChange={onChange} />;
    case "awakening":
      return (
        <MonsterAwakeningFilter
          filters={filters}
          onChange={onChange}
          singleGroupMode
        />
      );
  }
}

export function MonsterFilterPanel({ filters, onChange }: Props) {
  const active = hasActiveMonsterFilters(filters);
  const compactSections = useCompactFilterLayout();
  const [activeSection, setActiveSection] =
    useState<MonsterFilterSection>("awakening");

  return (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <div className="shrink-0">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)]">
          Monster
        </h2>

        <div className="mt-2 flex items-start justify-between gap-2">
          <p className="text-[10px] text-[var(--color-muted)]/80">
            Tap chips to filter stats & attributes
          </p>
          {active && (
            <MonsterFilterClearButton filters={filters} onChange={onChange} />
          )}
        </div>

        <MonsterActiveFilterChips filters={filters} onChange={onChange} />
      </div>

      {compactSections ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <FilterSectionTabBar
            sections={MONSTER_FILTER_SECTIONS}
            active={activeSection}
            onChange={setActiveSection}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MonsterFilterSectionContent
              section={activeSection}
              filters={filters}
              onChange={onChange}
            />
          </div>
        </div>
      ) : (
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="shrink-0 space-y-2">
            <MonsterRarityFilter filters={filters} onChange={onChange} />
            <MonsterAttributeFilter filters={filters} onChange={onChange} />
            <MonsterTypeFilter filters={filters} onChange={onChange} />
            <MonsterStatsFilter filters={filters} onChange={onChange} />
            <MonsterIdFilter filters={filters} onChange={onChange} />
          </div>
          <MonsterAwakeningFilter
            filters={filters}
            onChange={onChange}
            fillHeight
          />
        </div>
      )}
    </aside>
  );
}
