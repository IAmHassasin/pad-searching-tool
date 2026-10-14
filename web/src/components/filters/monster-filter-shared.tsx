import { type ReactNode } from "react";
import { EMPTY_MONSTER_FILTERS, type MonsterFilters } from "../../types";
import {
  MONSTER_ATTRIBUTES,
  hasAttributeSlotFilters,
  toggleAttributeSlot,
} from "../../lib/monster-attributes";
import { MONSTER_TYPES } from "../../lib/monster-types";
import { PAD_AWAKENING } from "../../lib/pad-constants";
import { MonsterAttributeSpriteIcon } from "../MonsterAttributeSpriteIcon";
import { MonsterTypeSpriteIcon } from "../MonsterTypeSpriteIcon";
import { CollapsibleFilterSection } from "./collapsible-filter-section";

export { MONSTER_TYPES };

export const RARITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const RARITY_ACCENT = "var(--color-gold)";

const ATTRIBUTE_SLOT_LABELS = ["Attr 1", "Attr 2", "Attr 3"] as const;
const ATTRIBUTE_ICON_SIZE = 24;

/** Element-colored selected state for attribute tiles (ids per MONSTER_ATTRIBUTES). */
const ATTRIBUTE_ACTIVE_CLASS: Record<number, string> = {
  0: "border-[var(--color-pad-fire)] bg-[var(--color-pad-fire)]/15 shadow-[0_0_10px_rgba(239,68,68,0.4)]",
  1: "border-[var(--color-pad-water)] bg-[var(--color-pad-water)]/15 shadow-[0_0_10px_rgba(56,189,248,0.4)]",
  2: "border-[var(--color-pad-wood)] bg-[var(--color-pad-wood)]/15 shadow-[0_0_10px_rgba(34,197,94,0.4)]",
  3: "border-[var(--color-pad-light)] bg-[var(--color-pad-light)]/15 shadow-[0_0_10px_rgba(251,191,36,0.4)]",
  4: "border-[var(--color-pad-dark)] bg-[var(--color-pad-dark)]/15 shadow-[0_0_10px_rgba(192,132,252,0.4)]",
  5: "border-pink-400 bg-pink-400/15 shadow-[0_0_10px_rgba(244,114,182,0.4)]",
};
const ATTRIBUTE_ACTIVE_FALLBACK_CLASS =
  "border-[var(--color-accent)] bg-[var(--color-accent-muted)] shadow-[var(--shadow-glow)]";

/** Shared look for removable "active filter" pills (hover hints removal). */
const ACTIVE_FILTER_PILL_CLASS =
  "pressable inline-flex items-center rounded-full border border-[var(--color-accent)]/50 bg-[var(--color-accent-muted)] hover:border-[var(--color-negative)]/60 hover:bg-[var(--color-negative)]/10";

export function toggleSet(set: Set<number>, n: number): Set<number> {
  const next = new Set(set);
  if (next.has(n)) next.delete(n);
  else next.add(n);
  return next;
}

export function hasActiveMonsterFilters(filters: MonsterFilters): boolean {
  return (
    filters.rarity.size > 0 ||
    hasAttributeSlotFilters(filters.attributeSlots) ||
    filters.types.size > 0 ||
    filters.hpMin != null ||
    filters.hpMax != null ||
    filters.atkMin != null ||
    filters.atkMax != null ||
    filters.rcvMin != null ||
    filters.rcvMax != null ||
    filters.idQuery.trim().length > 0 ||
    filters.awakeningIds.length > 0 ||
    filters.excludedAwakeningIds.length > 0 ||
    filters.vanishOnly ||
    filters.vanishAwakeningIds.length > 0
  );
}

export function FilterChip({
  label,
  selected,
  accent,
  onToggle,
  compact = false,
}: {
  label: string;
  selected: boolean;
  accent: string;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`group pressable inline-flex max-w-full items-center gap-1.5 rounded-full border font-semibold ${
        compact ? "px-2 py-0.5 text-[10px] leading-tight" : "px-2.5 py-1 text-[11px] leading-tight"
      } ${
        selected
          ? "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)] shadow-[var(--shadow-glow)]"
          : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-strong)]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? "opacity-100 shadow-[0_0_6px_currentColor]" : "opacity-50 group-hover:opacity-90"}`}
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function AttributeFilterIconChip({
  attributeId,
  label,
  selected,
  onToggle,
  size = ATTRIBUTE_ICON_SIZE,
}: {
  attributeId: number;
  label: string;
  selected: boolean;
  onToggle: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      className={`pressable shrink-0 rounded-lg border p-1 ${
        selected
          ? (ATTRIBUTE_ACTIVE_CLASS[attributeId] ?? ATTRIBUTE_ACTIVE_FALLBACK_CLASS)
          : "border-[var(--color-border)] bg-[var(--color-inset)] opacity-80 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)] hover:opacity-100"
      }`}
    >
      <MonsterAttributeSpriteIcon
        attributeId={attributeId}
        size={size}
        title={label}
      />
    </button>
  );
}

function AttributeMatchToggle({
  value,
  onChange,
}: {
  value: MonsterFilters["attributeMatch"];
  onChange: (mode: MonsterFilters["attributeMatch"]) => void;
}) {
  return (
    <div
      className="mb-2 flex rounded-full border border-[var(--color-border)] bg-[var(--color-inset)] p-0.5"
      role="radiogroup"
      aria-label="Attribute slot match mode"
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
          className={`pressable flex-1 rounded-full px-2 py-1 text-xs font-semibold ${
            value === id
              ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)] shadow-[var(--shadow-glow)]"
              : "text-[var(--color-muted)] hover:text-[var(--color-fg-strong)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TypeFilterIconChip({
  typeId,
  label,
  selected,
  onToggle,
  size = PAD_AWAKENING.iconSizePx,
}: {
  typeId: number;
  label: string;
  selected: boolean;
  onToggle: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      className={`pressable shrink-0 rounded-lg border p-0.5 ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] shadow-[var(--shadow-glow)]"
          : "border-[var(--color-border)] bg-[var(--color-inset)] opacity-80 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)] hover:opacity-100"
      }`}
    >
      <MonsterTypeSpriteIcon typeId={typeId} size={size} title={label} />
    </button>
  );
}

/** Labeled numeric input — the shared min/max convention (HP/ATK/RCV today,
 * advanced effect-value ranges reuse it too). Exported for that reuse. */
export function numInput(
  label: string,
  value: number | null,
  onChange: (v: number | null) => void,
  disabled = false
) {
  return (
    <label className="ds-label flex flex-col gap-1">
      {label}
      <input
        type="number"
        disabled={disabled}
        className="ds-input px-2 py-1 font-mono text-sm font-medium normal-case tabular-nums tracking-normal transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
      />
    </label>
  );
}

export function MonsterActiveFilterChips({
  filters,
  onChange,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
}) {
  if (
    filters.rarity.size === 0 &&
    !hasAttributeSlotFilters(filters.attributeSlots) &&
    filters.types.size === 0
  )
    return null;

  return (
    <div className="flex flex-wrap gap-1">
      {[...filters.rarity]
        .sort((a, b) => a - b)
        .map((r) => (
          <button
            key={`r-${r}`}
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                rarity: toggleSet(filters.rarity, r),
              })
            }
            className={`${ACTIVE_FILTER_PILL_CLASS} gap-1 px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--color-accent-strong)] hover:text-red-300`}
            title="Click to remove"
          >
            {r}★
            <span aria-hidden>×</span>
          </button>
        ))}
      {filters.attributeSlots.map((slot, slotIndex) =>
        [...slot]
          .sort((a, b) => a - b)
          .map((id) => {
            const label =
              MONSTER_ATTRIBUTES.find((a) => a.id === id)?.label ??
              `Attr ${id}`;
            return (
              <button
                key={`a${slotIndex}-${id}`}
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    attributeSlots: toggleAttributeSlot(
                      filters.attributeSlots,
                      slotIndex,
                      id
                    ),
                  })
                }
                className={`${ACTIVE_FILTER_PILL_CLASS} group gap-0.5 p-0.5`}
                title={`${ATTRIBUTE_SLOT_LABELS[slotIndex]}: ${label} — click to remove`}
                aria-label={`Remove ${ATTRIBUTE_SLOT_LABELS[slotIndex]} ${label} filter`}
              >
                <MonsterAttributeSpriteIcon
                  attributeId={id}
                  size={16}
                  title={label}
                />
                <span
                  className="px-0.5 text-[10px] text-[var(--color-accent-strong)] group-hover:text-red-300"
                  aria-hidden
                >
                  ×
                </span>
              </button>
            );
          })
      )}
      {MONSTER_TYPES.filter(({ id }) => filters.types.has(id)).map(
        ({ id, label }) => (
          <button
            key={`t-${id}`}
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                types: toggleSet(filters.types, id),
              })
            }
            className={`${ACTIVE_FILTER_PILL_CLASS} group gap-0.5 p-0.5`}
            title={`${label} — click to remove`}
            aria-label={`Remove ${label} filter`}
          >
            <MonsterTypeSpriteIcon typeId={id} size={16} title={label} />
            <span
              className="px-0.5 text-[10px] text-[var(--color-accent-strong)] group-hover:text-red-300"
              aria-hidden
            >
              ×
            </span>
          </button>
        )
      )}
    </div>
  );
}

export function MonsterRarityFilter({
  filters,
  onChange,
  compact = false,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
  compact?: boolean;
}) {
  const summary =
    filters.rarity.size > 0
      ? `${filters.rarity.size} / ${RARITIES.length} selected`
      : `${RARITIES.length} tiers`;

  return (
    <CollapsibleFilterSection
      title="Rarity"
      summary={summary}
      compact={compact}
      defaultOpen={false}
    >
      <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-1.5"}`}>
        {RARITIES.map((r) => (
          <FilterChip
            key={r}
            label={`${r}★`}
            selected={filters.rarity.has(r)}
            accent={RARITY_ACCENT}
            compact={compact}
            onToggle={() =>
              onChange({
                ...filters,
                rarity: toggleSet(filters.rarity, r),
              })
            }
          />
        ))}
      </div>
    </CollapsibleFilterSection>
  );
}

export function MonsterAttributeFilter({
  filters,
  onChange,
  compact = false,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
  compact?: boolean;
}) {
  const activeSlots = filters.attributeSlots.filter((s) => s.size > 0).length;
  const summary =
    activeSlots > 0
      ? `${activeSlots} slot${activeSlots === 1 ? "" : "s"} active`
      : "per slot";

  return (
    <CollapsibleFilterSection
      title="Attribute"
      summary={summary}
      compact={compact}
      defaultOpen={false}
    >
      {activeSlots > 0 && (
        <AttributeMatchToggle
          value={filters.attributeMatch}
          onChange={(attributeMatch) =>
            onChange({ ...filters, attributeMatch })
          }
        />
      )}
      <div className={compact ? "space-y-1" : "space-y-2"}>
        {ATTRIBUTE_SLOT_LABELS.map((slotLabel, slotIndex) => (
          <div key={slotLabel}>
            {!compact && (
              <p className="ds-label mb-1">
                {slotLabel}
              </p>
            )}
            <div
              className={`flex flex-nowrap overflow-x-auto pb-0.5 ${compact ? "gap-1" : "gap-1.5"}`}
            >
              {MONSTER_ATTRIBUTES.map(({ id, label }) => (
                <AttributeFilterIconChip
                  key={`${slotIndex}-${id}`}
                  attributeId={id}
                  label={`${slotLabel}: ${label}`}
                  selected={filters.attributeSlots[slotIndex].has(id)}
                  onToggle={() =>
                    onChange({
                      ...filters,
                      attributeSlots: toggleAttributeSlot(
                        filters.attributeSlots,
                        slotIndex,
                        id
                      ),
                    })
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleFilterSection>
  );
}

export function MonsterTypeFilter({
  filters,
  onChange,
  compact = false,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
  compact?: boolean;
}) {
  const summary =
    filters.types.size > 0
      ? `${filters.types.size} / ${MONSTER_TYPES.length} selected`
      : "any slot";

  return (
    <CollapsibleFilterSection
      title="Type"
      summary={summary}
      compact={compact}
      defaultOpen={false}
    >
      <div
        className={`flex flex-nowrap overflow-x-auto pb-0.5 ${compact ? "gap-1" : "gap-1.5"}`}
      >
        {MONSTER_TYPES.map(({ id, label }) => (
          <TypeFilterIconChip
            key={id}
            typeId={id}
            label={label}
            selected={filters.types.has(id)}
            onToggle={() =>
              onChange({
                ...filters,
                types: toggleSet(filters.types, id),
              })
            }
          />
        ))}
      </div>
    </CollapsibleFilterSection>
  );
}

export function MonsterStatsFilter({
  filters,
  onChange,
  compact = false,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
  compact?: boolean;
}) {
  const activeCount = [
    filters.hpMin,
    filters.hpMax,
    filters.atkMin,
    filters.atkMax,
    filters.rcvMin,
    filters.rcvMax,
  ].filter((v) => v != null).length;

  return (
    <CollapsibleFilterSection
      title="Stats range"
      summary={
        activeCount > 0
          ? `${activeCount} bound${activeCount === 1 ? "" : "s"}`
          : "HP / ATK / RCV"
      }
      compact={compact}
      defaultOpen={false}
    >
      <div className="grid grid-cols-2 gap-2">
        {numInput("HP min", filters.hpMin, (hpMin) =>
          onChange({ ...filters, hpMin })
        )}
        {numInput("HP max", filters.hpMax, (hpMax) =>
          onChange({ ...filters, hpMax })
        )}
        {numInput("ATK min", filters.atkMin, (atkMin) =>
          onChange({ ...filters, atkMin })
        )}
        {numInput("ATK max", filters.atkMax, (atkMax) =>
          onChange({ ...filters, atkMax })
        )}
        {numInput("RCV min", filters.rcvMin, (rcvMin) =>
          onChange({ ...filters, rcvMin })
        )}
        {numInput("RCV max", filters.rcvMax, (rcvMax) =>
          onChange({ ...filters, rcvMax })
        )}
      </div>
    </CollapsibleFilterSection>
  );
}

export function MonsterIdFilter({
  filters,
  onChange,
  compact = false,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
  compact?: boolean;
}) {
  const summary = filters.idQuery.trim()
    ? "search active"
    : "exact ID/NA# or name";

  return (
    <CollapsibleFilterSection
      title="ID / NA# / name"
      summary={summary}
      compact={compact}
      defaultOpen={false}
    >
      <input
        type="search"
        placeholder="Exact ID or NA# (older cards), or name…"
        className={`ds-input w-full transition-colors ${
          compact ? "px-2 py-1 text-xs" : "px-2 py-1.5 text-sm"
        }`}
        value={filters.idQuery}
        onChange={(e) => onChange({ ...filters, idQuery: e.target.value })}
      />
    </CollapsibleFilterSection>
  );
}

/**
 * Rarity/Attribute/Type/Stats/ID pinned as one compact, collapsed-by-default
 * group so Awakenings (the most-used filter) can claim the panel's vertical
 * space by default instead of competing with five separate accordion rows.
 */
export function MonsterMoreFiltersGroup({
  filters,
  onChange,
  compact = false,
  title = "More filters",
  idleSummary,
  headerExtra,
  contentClassName,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
  compact?: boolean;
  title?: string;
  /** Shown when no filters are active. Empty string hides the idle summary. */
  idleSummary?: string;
  headerExtra?: ReactNode;
  contentClassName?: string;
}) {
  const activeCount =
    (filters.rarity.size > 0 ? 1 : 0) +
    (hasAttributeSlotFilters(filters.attributeSlots) ? 1 : 0) +
    (filters.types.size > 0 ? 1 : 0) +
    ([filters.hpMin, filters.hpMax, filters.atkMin, filters.atkMax, filters.rcvMin, filters.rcvMax].some(
      (v) => v != null
    )
      ? 1
      : 0) +
    (filters.idQuery.trim() ? 1 : 0);

  const summary =
    activeCount > 0
      ? `${activeCount} active`
      : idleSummary !== undefined
        ? idleSummary
        : "rarity · attribute · type · stats · id";

  return (
    <CollapsibleFilterSection
      title={title}
      summary={summary}
      compact={compact}
      defaultOpen={false}
      className="shrink-0"
      headerExtra={headerExtra}
      contentClassName={contentClassName}
    >
      <div className="space-y-2">
        <MonsterRarityFilter filters={filters} onChange={onChange} compact={compact} />
        <MonsterAttributeFilter filters={filters} onChange={onChange} compact={compact} />
        <MonsterTypeFilter filters={filters} onChange={onChange} compact={compact} />
        <MonsterStatsFilter filters={filters} onChange={onChange} compact={compact} />
        <MonsterIdFilter filters={filters} onChange={onChange} compact={compact} />
      </div>
    </CollapsibleFilterSection>
  );
}

export function MonsterFilterClearButton({
  filters,
  onChange,
}: {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
}) {
  if (!hasActiveMonsterFilters(filters)) return null;

  return (
    <button
      type="button"
      onClick={() => onChange(EMPTY_MONSTER_FILTERS)}
      className="pressable shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted)] hover:bg-[var(--color-negative)]/10 hover:text-[var(--color-negative)]"
    >
      Clear all
    </button>
  );
}
