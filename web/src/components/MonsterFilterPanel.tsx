import { useState } from "react";
import type { MonsterFilters } from "../types";
import { useCompactFilterLayout } from "../hooks/useCompactFilterLayout";
import { useResizablePanel } from "../hooks/useResizablePanel";
import { ResizableSidePanel } from "./ResizableSidePanel";
import {
  MonsterActiveFilterChips,
  MonsterAttributeFilter,
  MonsterTypeFilter,
  MonsterFilterClearButton,
  MonsterIdFilter,
  MonsterMoreFiltersGroup,
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
  { id: "awakening", label: "Awk" },
  { id: "rarity", label: "R★" },
  { id: "attribute", label: "Attr" },
  { id: "type", label: "Type" },
  { id: "stats", label: "Stats" },
  { id: "id", label: "ID" },
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
      className="flex shrink-0 flex-wrap gap-1"
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
          className={`ds-pill pressable px-2.5 py-1 text-[11px] font-semibold ${
            active === id ? "ds-pill-active" : ""
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
      return (
        <MonsterRarityFilter filters={filters} onChange={onChange} defaultOpen />
      );
    case "attribute":
      return (
        <MonsterAttributeFilter
          filters={filters}
          onChange={onChange}
          defaultOpen
        />
      );
    case "type":
      return (
        <MonsterTypeFilter filters={filters} onChange={onChange} defaultOpen />
      );
    case "stats":
      return (
        <MonsterStatsFilter filters={filters} onChange={onChange} defaultOpen />
      );
    case "id":
      return (
        <MonsterIdFilter filters={filters} onChange={onChange} defaultOpen />
      );
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
  // Widest bounds of the two side panels — Awakenings (this panel's most-used
  // section) is an icon grid that reflows to fill whatever width it's given.
  const panel = useResizablePanel({
    storageKey: "monster",
    side: "left",
    // Wide enough by default for Awakenings to flow into 2 columns
    // out of the box (see the columns-[168px] layout in
    // awakening-filter-shared.tsx) instead of requiring a manual drag.
    defaultWidth: 400,
    minWidth: 300,
    maxWidth: 720,
  });

  return (
    <ResizableSidePanel
      side="left"
      collapsed={panel.collapsed}
      width={panel.width}
      dragHandleProps={panel.dragHandleProps}
      collapsedLabel="Monster"
      onExpandToggle={panel.toggleCollapsed}
      ariaLabel="monster filters"
    >
      <div className="flex h-full min-w-0 flex-col overflow-hidden p-3">
        <div className="shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[var(--color-fg-strong)]">
              <span
                aria-hidden
                className="h-3.5 w-1 rounded-full bg-[var(--color-accent)] shadow-[var(--shadow-glow)]"
              />
              Monster
            </h2>
            <button
              type="button"
              onClick={panel.toggleCollapsed}
              title="Collapse monster filters"
              aria-label="Collapse monster filters"
              className="pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white/5 text-[var(--color-muted)] hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-accent-muted)] hover:text-[var(--color-accent-strong)]"
            >
              <span aria-hidden className="text-sm leading-none">
                ‹
              </span>
            </button>
          </div>

          <div className="mt-2 flex items-start justify-between gap-2">
            <p className="text-[10px] text-[var(--color-faint)]">
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
                key={activeSection}
                section={activeSection}
                filters={filters}
                onChange={onChange}
              />
            </div>
          </div>
        ) : (
          // Awakenings first and flex-1: it's the most-used filter, so it
          // gets first claim on vertical space. The rest are pinned below,
          // collapsed into one compact group — expand only when needed.
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col">
              <MonsterAwakeningFilter
                filters={filters}
                onChange={onChange}
                fillHeight
              />
            </div>
            <MonsterMoreFiltersGroup filters={filters} onChange={onChange} />
          </div>
        )}
      </div>
    </ResizableSidePanel>
  );
}
