import { AWAKENING_FILTER_GROUPS } from "../../lib/awakening-filter-groups";
import type { MonsterFilters } from "../../types";
import { AwakeningSpriteIcon } from "../AwakeningSpriteIcon";

const AWK_ACCENT = "#6b8f3c";

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
  iconSize,
  onAppend,
}: {
  id: number;
  inStack: number;
  iconSize: number;
  onAppend: (id: number) => void;
}) {
  return (
    <button
      type="button"
      title={
        inStack
          ? `Awakening #${id} ×${inStack} — tap to add`
          : `Awakening #${id} — tap to stack`
      }
      aria-pressed={inStack > 0}
      onClick={() => onAppend(id)}
      className={`flex shrink-0 items-center justify-center rounded-sm border p-0.5 transition-colors ${
        inStack > 0
          ? "border-[var(--color-accent)] bg-[#1f3a5f] shadow-[inset_0_0_0_1px_rgba(88,166,255,0.35)]"
          : "border-transparent hover:border-[#6b8f3c]/50 hover:bg-[#21262d]"
      }`}
      style={
        inStack > 0 ? { boxShadow: `inset 0 0 0 1px ${AWK_ACCENT}` } : undefined
      }
    >
      <AwakeningSpriteIcon awokenSkillId={id} size={iconSize} />
    </button>
  );
}

export function AwakeningMatchToggle({
  value,
  onChange,
  compact = false,
}: {
  value: MonsterFilters["awakeningMatch"];
  onChange: (mode: MonsterFilters["awakeningMatch"]) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex rounded-lg border border-[var(--color-border)] bg-[#0d1117] p-0.5 ${
        compact ? "mb-2" : "mb-3"
      }`}
      role="radiogroup"
      aria-label="Awakening match mode"
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
          className={`flex-1 rounded-md px-2 py-1 font-medium transition-colors ${
            compact ? "text-[10px]" : "text-xs"
          } ${
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

export function MonsterAwakeningClearAllButton({
  filters,
  onChange,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
}) {
  if (filters.awakeningIds.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => onChange({ ...filters, awakeningIds: [] })}
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
  const grouped = groupAwakeningStack(filters.awakeningIds);
  if (!grouped.length) return null;

  return (
    <>
      {grouped.map(({ id, count }) => (
        <button
          key={id}
          type="button"
          onClick={() =>
            onChange({
              ...filters,
              awakeningIds: removeOneAwakeningFromStack(
                filters.awakeningIds,
                id
              ),
            })
          }
          className="inline-flex items-center gap-0.5 rounded-full border border-[#6b8f3c]/60 bg-[#1a2a12] p-0.5 pr-1.5 hover:border-red-500/50"
          title={
            count > 1
              ? `Remove one #${id} (${count} stacked)`
              : `Remove awakening #${id}`
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
    </>
  );
}

function AwakeningFilterGroupSection({
  label,
  rows,
  stack,
  iconSize,
  compact,
  onAppend,
}: {
  label: string;
  rows: number[][];
  stack: number[];
  iconSize: number;
  compact: boolean;
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
                iconSize={iconSize}
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
  const iconSize = compact ? 18 : fillHeight ? 24 : 20;
  const stack = filters.awakeningIds;

  const appendId = (id: number) =>
    onChange({
      ...filters,
      awakeningIds: pushAwakeningStack(stack, id),
    });

  return (
    <section
      className={
        fillHeight ? "flex min-h-0 flex-1 flex-col overflow-hidden" : undefined
      }
    >
      {!compact && (
        <div className="mb-2 flex shrink-0 items-baseline justify-between gap-2">
          <p className="text-xs font-semibold text-white">Awakenings</p>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[10px] text-[var(--color-muted)]">
              {stack.length > 0
                ? `${stack.length} selected`
                : "tap icons to stack"}
            </span>
            <MonsterAwakeningClearAllButton
              filters={filters}
              onChange={onChange}
            />
          </div>
        </div>
      )}

      {(stack.length > 0 || compact) && (
        <div className="mb-2 flex flex-wrap items-start justify-between gap-1">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            <MonsterAwakeningSelectedChips
              filters={filters}
              onChange={onChange}
            />
          </div>
          {compact && (
            <MonsterAwakeningClearAllButton
              filters={filters}
              onChange={onChange}
            />
          )}
        </div>
      )}

      <AwakeningMatchToggle
        value={filters.awakeningMatch}
        onChange={(awakeningMatch) => onChange({ ...filters, awakeningMatch })}
        compact={compact}
      />

      <div
        className={
          compact
            ? "max-h-[28vh] overflow-y-auto rounded-md border border-[var(--color-border)] bg-[#0d1117]/60 p-1.5"
            : fillHeight
              ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[#0d1117]/60 p-2"
              : "max-h-52 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[#0d1117]/60 p-2"
        }
      >
        <div
          className={
            fillHeight ? "min-h-0 flex-1 overflow-y-auto pr-0.5" : undefined
          }
        >
          {AWAKENING_FILTER_GROUPS.map((group) => (
            <AwakeningFilterGroupSection
              key={group.label}
              label={group.label}
              rows={group.rows}
              stack={stack}
              iconSize={iconSize}
              compact={compact}
              onAppend={appendId}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
