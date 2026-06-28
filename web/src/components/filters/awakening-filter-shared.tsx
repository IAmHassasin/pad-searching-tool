import { AWAKENING_FILTER_GROUPS } from "../../lib/awakening-filter-groups";
import type { MonsterFilters } from "../../types";
import { AwakeningSpriteIcon } from "../AwakeningSpriteIcon";
import { CollapsibleFilterSection } from "./collapsible-filter-section";

const AWK_ACCENT = "#6b8f3c";
const AWK_EXCLUDE_ACCENT = "#f85149";
const VANISH_ACCENT = "#c9a84a";

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
      className={`flex shrink-0 items-center justify-center rounded-sm border p-0.5 transition-colors ${
        active > 0
          ? pickerMode === "include"
            ? "border-[var(--color-accent)] bg-[#1f3a5f] shadow-[inset_0_0_0_1px_rgba(88,166,255,0.35)]"
            : pickerMode === "exclude"
              ? "border-red-500/70 bg-red-950/40 shadow-[inset_0_0_0_1px_rgba(248,81,73,0.35)]"
              : "border-[#c9a84a]/80 bg-[#3a2f12] shadow-[inset_0_0_0_1px_rgba(201,168,74,0.35)]"
          : inStack > 0
            ? "border-[#6b8f3c]/40 bg-[#1a2a12]/60"
            : excludedInStack > 0
              ? "border-red-500/30 bg-red-950/20"
              : vanishInStack > 0
                ? "border-[#c9a84a]/30 bg-[#3a2f12]/40"
                : "border-transparent hover:border-[#6b8f3c]/50 hover:bg-[#21262d]"
      }`}
      style={
        active > 0 ? { boxShadow: `inset 0 0 0 1px ${accent}` } : undefined
      }
    >
      <AwakeningSpriteIcon awokenSkillId={id} size={iconSize} />
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
      className={`flex rounded-lg border border-[var(--color-border)] bg-[#0d1117] p-0.5 ${
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
          className={`flex-1 rounded-md px-2 py-1 font-medium transition-colors ${
            compact ? "text-[10px]" : "text-xs"
          } ${
            value === id
              ? id === "exclude"
                ? "bg-red-600 text-white"
                : id === "vanish"
                  ? "bg-[#8b6914] text-white"
                  : "bg-[var(--color-accent)] text-[#0d1117]"
              : "text-[var(--color-muted)] hover:text-white"
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
      className="shrink-0 rounded border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)] hover:border-red-500/50 hover:text-red-300"
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
          className="inline-flex items-center gap-0.5 rounded-full border border-[#6b8f3c]/60 bg-[#1a2a12] p-0.5 pr-1.5 hover:border-red-500/50"
          title={
            count > 1
              ? `Remove one included #${id} (${count} stacked)`
              : `Remove included awakening #${id}`
          }
        >
          <AwakeningSpriteIcon awokenSkillId={id} size={16} />
          {count > 1 && (
            <span className="text-[9px] font-bold tabular-nums text-[#a8c878]">
              ×{count}
            </span>
          )}
          <span className="text-[9px] text-[#a8c878]">×</span>
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
          className="inline-flex items-center gap-0.5 rounded-full border border-red-500/60 bg-red-950/30 p-0.5 pr-1.5 hover:border-red-400"
          title={
            count > 1
              ? `Remove one excluded #${id} (${count} stacked)`
              : `Remove excluded awakening #${id}`
          }
        >
          <AwakeningSpriteIcon awokenSkillId={id} size={16} />
          <span className="text-[9px] font-bold text-red-300">≠</span>
          {count > 1 && (
            <span className="text-[9px] font-bold tabular-nums text-red-300">
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
          className="inline-flex items-center gap-0.5 rounded-full border border-[#c9a84a]/60 bg-[#3a2f12] p-0.5 pr-1.5 hover:border-red-500/50"
          title={
            count > 1
              ? `Remove one vanish #${id} (${count} stacked)`
              : `Remove vanish grant #${id}`
          }
        >
          <AwakeningSpriteIcon awokenSkillId={id} size={16} />
          {count > 1 && (
            <span className="text-[9px] font-bold tabular-nums text-[#c9a84a]">
              ×{count}
            </span>
          )}
          <span className="text-[9px] text-[#c9a84a]">×</span>
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
}) {
  return (
    <section className={compact ? "mb-2 last:mb-0" : "mb-3 last:mb-0"}>
      <p
        className={`mb-1 font-semibold uppercase tracking-wide text-[#a8c878] ${
          compact ? "text-[9px]" : "text-[10px]"
        }`}
      >
        {label}
      </p>
      <div className="space-y-1">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex flex-wrap gap-0.5">
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

export function MonsterAwakeningFilter({
  filters,
  onChange,
  compact = false,
  fillHeight = false,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
  compact?: boolean;
  fillHeight?: boolean;
}) {
  const iconSize = compact ? 18 : fillHeight ? 22 : 20;
  const pickerMode = filters.awakeningPickerMode;
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

  const gridClass = compact
    ? "max-h-[28vh] overflow-y-auto pr-0.5"
    : fillHeight
      ? "min-h-0 flex-1 overflow-y-auto pr-0.5"
      : "pr-0.5";

  return (
    <CollapsibleFilterSection
      title="Awakenings"
      summary={summary}
      compact={compact}
      defaultOpen
      fillHeight={fillHeight && !compact}
      headerExtra={
        <MonsterAwakeningClearAllButton filters={filters} onChange={onChange} />
      }
    >
      <label
        className={`mb-3 flex cursor-pointer items-center gap-2 rounded-md border border-[#8b6914]/50 bg-[#2a1f14]/60 px-2 py-1.5 ${
          compact ? "text-[10px]" : "text-xs"
        }`}
      >
        <input
          type="checkbox"
          checked={filters.vanishOnly}
          onChange={(e) =>
            onChange({ ...filters, vanishOnly: e.target.checked })
          }
          className="accent-[#c9a84a]"
        />
        <span className="font-medium text-[#e8dcc8]">Vanish only</span>
        <span className="text-[var(--color-muted)]">
          — assists with vanish-grant data
        </span>
      </label>

      {totalSelected > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
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
            compact ? "mb-2 text-[9px]" : "mb-3 text-[10px]"
          }`}
        >
          Monster must not have selected awakening in regular, super, or sync
          slots.
        </p>
      )}
      {pickerMode === "vanish" && (
        <p
          className={`text-[var(--color-muted)] ${
            compact ? "mb-2 text-[9px]" : "mb-3 text-[10px]"
          }`}
        >
          Filter by awoken skills granted when the assist vanishes (active
          skill). Match all selected.
        </p>
      )}

      <div className={gridClass}>
        {AWAKENING_FILTER_GROUPS.map((group) => (
          <AwakeningFilterGroupSection
            key={group.label}
            label={group.label}
            rows={group.rows}
            stack={filters.awakeningIds}
            excludedStack={filters.excludedAwakeningIds}
            vanishStack={filters.vanishAwakeningIds}
            iconSize={iconSize}
            compact={compact}
            pickerMode={pickerMode}
            onAppend={appendId}
          />
        ))}
      </div>
    </CollapsibleFilterSection>
  );
}
