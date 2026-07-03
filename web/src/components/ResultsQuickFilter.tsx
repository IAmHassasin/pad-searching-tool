import type { ReactNode } from "react";
import { ASSIST_EQUIPMENT_AWAKENING_ID } from "../lib/monster-search-url";
import type { ResultQuickFilter } from "../lib/result-quick-filter";
import { AwakeningSpriteIcon } from "./AwakeningSpriteIcon";
import { MonsterTypeSpriteIcon } from "./MonsterTypeSpriteIcon";

/** Dragon — representative playable monster type. */
const MONSTER_QUICK_FILTER_TYPE_ID = 4;

type Props = {
  value: ResultQuickFilter;
  onChange: (next: ResultQuickFilter) => void;
  compact?: boolean;
};

function FilterIconButton({
  label,
  active,
  onClick,
  compact,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
  children: ReactNode;
}) {
  const iconSize = compact ? 14 : 16;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`flex shrink-0 items-center justify-center rounded border p-0.5 transition-colors ${
        active
          ? "border-[var(--color-accent)] bg-[#1f3a5f] ring-1 ring-[var(--color-accent)]/40"
          : "border-[var(--color-border)] bg-[#0d1117] hover:border-[var(--color-accent)]/50"
      }`}
      style={{ width: iconSize + 6, height: iconSize + 6 }}
    >
      {children}
    </button>
  );
}

export function ResultsQuickFilter({ value, onChange, compact = false }: Props) {
  const iconSize = compact ? 14 : 16;

  const toggle = (next: Exclude<ResultQuickFilter, null>) => {
    onChange(value === next ? null : next);
  };

  return (
    <div className="flex items-center gap-0.5">
      <FilterIconButton
        label="Monsters only"
        active={value === "monster"}
        onClick={() => toggle("monster")}
        compact={compact}
      >
        <MonsterTypeSpriteIcon
          typeId={MONSTER_QUICK_FILTER_TYPE_ID}
          size={iconSize}
        />
      </FilterIconButton>
      <FilterIconButton
        label="Assist equipment only"
        active={value === "eq"}
        onClick={() => toggle("eq")}
        compact={compact}
      >
        <AwakeningSpriteIcon
          awokenSkillId={ASSIST_EQUIPMENT_AWAKENING_ID}
          size={iconSize}
        />
      </FilterIconButton>
    </div>
  );
}
