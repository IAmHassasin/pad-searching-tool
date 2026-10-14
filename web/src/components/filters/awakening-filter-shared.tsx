import { AWAKENING_FILTER_GROUPS } from "../../lib/awakening-filter-groups";
import { VANISH_FILTER_GROUPS } from "../../lib/vanish-filter-groups";
import type { MonsterFilters } from "../../types";
import { AwakeningSpriteIcon } from "../AwakeningSpriteIcon";
import { CollapsibleFilterSection } from "./collapsible-filter-section";
import { SupplementFilterCheckbox } from "./supplement-filter-checkbox";
import { useEffect, useState } from "react";

/** Include-mode selected tiles use the cyan "tech" accent; chips stay emerald. */
const AWK_ACCENT = "var(--color-secondary)";
const AWK_EXCLUDE_ACCENT = "var(--color-negative)";
const VANISH_ACCENT = "var(--color-gold)";

export {
  listFilterableAwakeningIds,
} from "../../lib/awakening-filter-groups";

export function pushAwakeningStack(stack: number[], id: number): number[] {
  return [...stack, id];
}

export function removeOneAwakeningFromStack(
  stack: number[],
  id: number
): number[] {
  const idx = stack.lastIndexOf(id);
  if (idx < 0) return stack;
  return stack.filter((_, i) => i !== idx);
}

export function countAwakeningInStack(stack: number[], id: number): number {
  return stack.filter((x) => x === id).length;
}

/** Unique ids in first-seen order with counts. */
export function groupAwakeningStack(
  stack: number[]
): { id: number; count: number }[] {
  const order: number[] = [];
  const counts = new Map<number, number>();
  for (const id of stack) {
    if (!counts.has(id)) order.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return order.map((id) => ({ id, count: counts.get(id)! }));
}

function AwakeningPickerIcon({
  id,
  inStack,
  excludedInStack,
  vanishInStack,
  iconSize,
  pickerMode,
  onAppend,
}: {
  id: number;
  inStack: number;
  excludedInStack: number;
  vanishInStack: number;
  iconSize: number;
  pickerMode: MonsterFilters["awakeningPickerMode"];
  onAppend: (id: number) => void;
}) {
  const active =
    pickerMode === "include"
      ? inStack
      : pickerMode === "exclude"
        ? excludedInStack
        : vanishInStack;

  const accent =
    pickerMode === "exclude"
      ? AWK_EXCLUDE_ACCENT
      : pickerMode === "vanish"
        ? VANISH_ACCENT
        : AWK_ACCENT;

  return (
    <button
      type="button"
      title={
        active
          ? pickerMode === "include"
            ? `Include #${id} ×${active} — tap to add`
            : pickerMode === "exclude"
              ? `Exclude #${id} ×${active} — tap to add`
              : `Vanish #${id} ×${active} — tap to add`
          : pickerMode === "include"
            ? `Awakening #${id} — tap to include`
            : pickerMode === "exclude"
              ? `Awakening #${id} — tap to exclude`
              : `Vanish grant #${id} — tap to add`
      }
      aria-pressed={active > 0}
      onClick={() => onAppend(id)}
      className={`pressable relative flex shrink-0 items-center justify-center rounded border p-0.5 ${
        active > 0
          ? pickerMode === "include"
            ? "border-[var(--color-secondary)] bg-[var(--color-secondary-muted)] shadow-[var(--shadow-glow-cyan)]"
            : pickerMode === "exclude"
              ? "border-[var(--color-negative)] bg-[var(--color-negative)]/15 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
              : "border-[var(--color-gold)] bg-[var(--color-amber-bg)] shadow-[var(--shadow-glow)]"
          : inStack > 0
            ? "border-[var(--color-positive)]/40 bg-emerald-500/10"
            : excludedInStack > 0
              ? "border-[var(--color-negative)]/30 bg-[var(--color-negative)]/10"
              : vanishInStack > 0
                ? "border-[var(--color-gold)]/30 bg-[var(--color-amber-bg)]"
                : "border-transparent hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)]"
      }`}
    >
      <AwakeningSpriteIcon awokenSkillId={id} size={iconSize} />
      {active > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 min-w-3 rounded-full px-0.5 text-center font-mono text-[8px] font-bold leading-3 tabular-nums text-slate-950 ring-1 ring-[var(--color-inset)]"
          style={{ backgroundColor: accent }}
        >
          {active}
        </span>
      )}
    </button>
  );
}

export function AwakeningPickerModeToggle({
  value,
  onChange,
  compact = false,
}: {
  value: MonsterFilters["awakeningPickerMode"];
  onChange: (mode: MonsterFilters["awakeningPickerMode"]) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex rounded-full border border-[var(--color-border)] bg-[var(--color-inset)] p-0.5 ${
        compact ? "mb-2" : "mb-3"
      }`}
      role="radiogroup"
      aria-label="Awakening picker mode"
    >
      {(
        [
          { id: "include" as const, label: "Include" },
          { id: "exclude" as const, label: "Exclude" },
          { id: "vanish" as const, label: "Vanish" },
        ] as const
      ).map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={`pressable flex-1 rounded-full px-2 py-1 font-semibold ${
            compact ? "text-[10px]" : "text-xs"
          } ${
            value === id
              ? id === "exclude"
                ? "bg-[var(--color-negative)]/15 text-red-300 ring-1 ring-[var(--color-negative)]/60"
                : id === "vanish"
                  ? "bg-[var(--color-amber-bg)] text-[var(--color-gold)] ring-1 ring-[var(--color-gold)]/60"
                  : "bg-emerald-500/15 text-emerald-300 ring-1 ring-[var(--color-positive)]/60"
              : "text-[var(--color-muted)] hover:text-[var(--color-fg-strong)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function MonsterAwakeningClearAllButton({
  filters,
  onChange,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
}) {
  if (
    filters.awakeningIds.length === 0 &&
    filters.excludedAwakeningIds.length === 0 &&
    !filters.vanishOnly &&
    filters.vanishAwakeningIds.length === 0
  ) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() =>
        onChange({
          ...filters,
          awakeningIds: [],
          excludedAwakeningIds: [],
          vanishOnly: false,
          vanishAwakeningIds: [],
        })
      }
      className="pressable shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted)] hover:bg-[var(--color-negative)]/10 hover:text-[var(--color-negative)]"
    >
      Clear all
    </button>
  );
}

export function MonsterAwakeningSelectedChips({
  filters,
  onChange,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
}) {
  const included = groupAwakeningStack(filters.awakeningIds);
  const excluded = groupAwakeningStack(filters.excludedAwakeningIds);
  const vanish = groupAwakeningStack(filters.vanishAwakeningIds);
  if (!included.length && !excluded.length && !vanish.length) return null;

  return (
    <>
      {included.map(({ id, count }) => (
        <button
          key={`inc-${id}`}
          type="button"
          onClick={() =>
            onChange({
              ...filters,
              awakeningIds: removeOneAwakeningFromStack(filters.awakeningIds, id),
            })
          }
          className="pressable inline-flex items-center gap-0.5 rounded-full border border-[var(--color-positive)]/60 bg-emerald-500/10 p-0.5 pr-1.5 hover:border-[var(--color-negative)]/60"
          title={
            count > 1
              ? `Remove one included #${id} (${count} stacked)`
              : `Remove included awakening #${id}`
          }
        >
          <AwakeningSpriteIcon awokenSkillId={id} size={16} />
          {count > 1 && (
            <span className="font-mono text-[9px] font-bold tabular-nums text-emerald-300">
              ×{count}
            </span>
          )}
          <span className="text-[9px] text-emerald-300">×</span>
        </button>
      ))}
      {excluded.map(({ id, count }) => (
        <button
          key={`exc-${id}`}
          type="button"
          onClick={() =>
            onChange({
              ...filters,
              excludedAwakeningIds: removeOneAwakeningFromStack(
                filters.excludedAwakeningIds,
                id
              ),
            })
          }
          className="pressable inline-flex items-center gap-0.5 rounded-full border border-[var(--color-negative)]/60 bg-[var(--color-negative)]/10 p-0.5 pr-1.5 hover:border-red-400"
          title={
            count > 1
              ? `Remove one excluded #${id} (${count} stacked)`
              : `Remove excluded awakening #${id}`
          }
        >
          <AwakeningSpriteIcon awokenSkillId={id} size={16} />
          <span className="text-[9px] font-bold text-red-300">≠</span>
          {count > 1 && (
            <span className="font-mono text-[9px] font-bold tabular-nums text-red-300">
              ×{count}
            </span>
          )}
          <span className="text-[9px] text-red-300">×</span>
        </button>
      ))}
      {vanish.map(({ id, count }) => (
        <button
          key={`van-${id}`}
          type="button"
          onClick={() =>
            onChange({
              ...filters,
              vanishAwakeningIds: removeOneAwakeningFromStack(
                filters.vanishAwakeningIds,
                id
              ),
            })
          }
          className="pressable inline-flex items-center gap-0.5 rounded-full border border-[var(--color-gold)]/60 bg-[var(--color-amber-bg)] p-0.5 pr-1.5 hover:border-[var(--color-negative)]/60"
          title={
            count > 1
              ? `Remove one vanish #${id} (${count} stacked)`
              : `Remove vanish grant #${id}`
          }
        >
          <AwakeningSpriteIcon awokenSkillId={id} size={16} />
          {count > 1 && (
            <span className="font-mono text-[9px] font-bold tabular-nums text-[var(--color-gold)]">
              ×{count}
            </span>
          )}
          <span className="text-[9px] text-[var(--color-gold)]">×</span>
        </button>
      ))}
    </>
  );
}

function AwakeningFilterGroupSection({
  label,
  rows,
  stack,
  excludedStack,
  vanishStack,
  iconSize,
  compact,
  pickerMode,
  onAppend,
  hideLabel = false,
}: {
  label: string;
  rows: number[][];
  stack: number[];
  excludedStack: number[];
  vanishStack: number[];
  iconSize: number;
  compact: boolean;
  pickerMode: MonsterFilters["awakeningPickerMode"];
  onAppend: (id: number) => void;
  hideLabel?: boolean;
}) {
  return (
    <section
      className={`break-inside-avoid ${compact ? "mb-1.5" : "mb-2"}`}
    >
      {!hideLabel && (
        <p
          className={`ds-label mb-1 ${compact ? "text-[9px]" : "text-[10px]"}`}
        >
          {label}
        </p>
      )}
      <div className="space-y-1">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex flex-wrap gap-1">
            {row.map((id) => (
              <AwakeningPickerIcon
                key={`${rowIndex}-${id}`}
                id={id}
                inStack={countAwakeningInStack(stack, id)}
                excludedInStack={countAwakeningInStack(excludedStack, id)}
                vanishInStack={countAwakeningInStack(vanishStack, id)}
                iconSize={iconSize}
                pickerMode={pickerMode}
                onAppend={onAppend}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

const AWAKENING_GROUP_SHORT_LABELS: Record<string, string> = {
  Basic: "Basic",
  "Sub att": "Sub",
  "Add Type": "+Type",
  Stats: "Stats",
  "Match style": "Match",
  Resist: "Res",
  Killer: "Kill",
  "Enhance orb": "Enh",
  Others: "Other",
};

function AwakeningGroupTabBar({
  groups,
  activeIndex,
  onChange,
}: {
  groups: typeof AWAKENING_FILTER_GROUPS;
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <div
      className="mb-1.5 flex shrink-0 flex-wrap gap-1"
      role="tablist"
      aria-label="Awakening groups"
    >
      {groups.map((group, index) => (
        <button
          key={group.label}
          type="button"
          role="tab"
          aria-selected={activeIndex === index}
          onClick={() => onChange(index)}
          className={`ds-pill pressable px-2 py-0.5 text-[10px] font-semibold ${
            activeIndex === index ? "ds-pill-active" : ""
          }`}
        >
          {AWAKENING_GROUP_SHORT_LABELS[group.label] ?? group.label}
        </button>
      ))}
    </div>
  );
}

export function MonsterAwakeningFilter({
  filters,
  onChange,
  compact = false,
  fillHeight = false,
  singleGroupMode = false,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
  compact?: boolean;
  fillHeight?: boolean;
  /** When true, show one awakening group at a time with tab buttons. */
  singleGroupMode?: boolean;
}) {
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const iconSize = compact ? 16 : fillHeight ? 18 : 18;
  const pickerMode = filters.awakeningPickerMode;

  useEffect(() => {
    setActiveGroupIndex(0);
  }, [pickerMode]);
  const totalSelected =
    filters.awakeningIds.length +
    filters.excludedAwakeningIds.length +
    filters.vanishAwakeningIds.length;

  const appendId = (id: number) => {
    if (pickerMode === "vanish") {
      onChange({
        ...filters,
        vanishAwakeningIds: pushAwakeningStack(filters.vanishAwakeningIds, id),
      });
      return;
    }
    if (pickerMode === "exclude") {
      onChange({
        ...filters,
        excludedAwakeningIds: pushAwakeningStack(
          filters.excludedAwakeningIds,
          id
        ),
      });
      return;
    }
    onChange({
      ...filters,
      awakeningIds: pushAwakeningStack(filters.awakeningIds, id),
    });
  };

  const summaryParts: string[] = [];
  if (filters.vanishOnly) summaryParts.push("vanish only");
  if (filters.awakeningIds.length) {
    summaryParts.push(`${filters.awakeningIds.length} inc`);
  }
  if (filters.excludedAwakeningIds.length) {
    summaryParts.push(`${filters.excludedAwakeningIds.length} excl`);
  }
  if (filters.vanishAwakeningIds.length) {
    summaryParts.push(`${filters.vanishAwakeningIds.length} vanish`);
  }
  const summary =
    summaryParts.length > 0 ? summaryParts.join(" · ") : "regular + super + sync";

  const awakeningGroups =
    pickerMode === "vanish" ? VANISH_FILTER_GROUPS : AWAKENING_FILTER_GROUPS;
  const safeGroupIndex = Math.min(
    activeGroupIndex,
    Math.max(0, awakeningGroups.length - 1)
  );

  const useGroupTabs = singleGroupMode;
  const visibleGroups = useGroupTabs
    ? [awakeningGroups[safeGroupIndex]].filter(Boolean)
    : awakeningGroups;

  const gridClass =
    compact && useGroupTabs
      ? "max-h-[22vh] overflow-y-auto pr-0.5"
      : fillHeight && useGroupTabs
        ? "min-h-0 flex-1 overflow-y-auto pr-0.5"
        : fillHeight
          ? // All groups at once, desktop: flow into as many ~168px columns as
            // the (resizable) panel width allows instead of one tall stack —
            // uses width to cut down how much needs to scroll vertically.
            "min-h-0 flex-1 overflow-y-auto columns-[168px] gap-x-3 pr-0.5 [column-fill:auto]"
          : "pr-0.5";

  return (
    <CollapsibleFilterSection
      title="Awakenings"
      summary={summary}
      compact={compact}
      defaultOpen
      fillHeight={fillHeight}
      headerExtra={
        <MonsterAwakeningClearAllButton filters={filters} onChange={onChange} />
      }
    >
      <SupplementFilterCheckbox
        label="Vanish only"
        checked={filters.vanishOnly}
        onChange={(vanishOnly) => onChange({ ...filters, vanishOnly })}
        compact={compact}
      />

      {totalSelected > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          <MonsterAwakeningSelectedChips filters={filters} onChange={onChange} />
        </div>
      )}

      <AwakeningPickerModeToggle
        value={pickerMode}
        onChange={(awakeningPickerMode) =>
          onChange({ ...filters, awakeningPickerMode })
        }
        compact={compact}
      />

      {pickerMode === "exclude" && (
        <p
          className={`text-[var(--color-muted)] ${
            compact ? "mb-1 text-[9px]" : "mb-1.5 text-[9px]"
          }`}
        >
          Must not have selected awk in regular, super, or sync.
        </p>
      )}
      {pickerMode === "vanish" && (
        <p
          className={`text-[var(--color-muted)] ${
            compact ? "mb-1 text-[9px]" : "mb-1.5 text-[9px]"
          }`}
        >
          Match vanish-granted awokens (all selected).
        </p>
      )}

      {useGroupTabs && (
        <AwakeningGroupTabBar
          groups={awakeningGroups}
          activeIndex={safeGroupIndex}
          onChange={setActiveGroupIndex}
        />
      )}

      <div className={gridClass}>
        {visibleGroups.map((group) => (
          <AwakeningFilterGroupSection
            key={group.label}
            label={group.label}
            rows={group.rows}
            stack={filters.awakeningIds}
            excludedStack={filters.excludedAwakeningIds}
            vanishStack={filters.vanishAwakeningIds}
            iconSize={iconSize}
            compact={compact || useGroupTabs}
            hideLabel={useGroupTabs}
            pickerMode={pickerMode}
            onAppend={appendId}
          />
        ))}
      </div>
    </CollapsibleFilterSection>
  );
}
