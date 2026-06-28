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

export const RARITY_ACCENT = "#d29922";

const ATTRIBUTE_SLOT_LABELS = ["Attr 1", "Attr 2", "Attr 3"] as const;
const ATTRIBUTE_ICON_SIZE = 24;

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
      className={`group inline-flex max-w-full items-center gap-1 rounded-md border transition-colors ${
        compact ? "px-1.5 py-0.5 text-[10px] leading-tight" : "px-2 py-1 text-[11px] leading-tight"
      } ${
        selected
          ? "border-[var(--color-accent)] bg-[#1f3a5f] text-white shadow-[inset_0_0_0_1px_rgba(88,166,255,0.25)]"
          : "border-[var(--color-border)] bg-[#0d1117] text-[#c9d1d9] hover:border-[var(--color-accent)]/60 hover:bg-[#21262d]"
      }`}
      style={
        selected ? { boxShadow: `inset 3px 0 0 0 ${accent}` } : undefined
      }
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}
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
      className={`shrink-0 rounded-md border p-0.5 transition-colors ${
        selected
          ? "border-[var(--color-accent)] bg-[#1f3a5f] shadow-[inset_0_0_0_1px_rgba(88,166,255,0.25)]"
          : "border-[var(--color-border)] bg-[#0d1117] hover:border-[var(--color-accent)]/60 hover:bg-[#21262d]"
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
      className="mb-2 flex rounded-lg border border-[var(--color-border)] bg-[#0d1117] p-0.5"
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
          className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
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
      className={`shrink-0 rounded-md border p-0.5 transition-colors ${
        selected
          ? "border-[var(--color-accent)] bg-[#1f3a5f] shadow-[inset_0_0_0_1px_rgba(88,166,255,0.25)]"
          : "border-[var(--color-border)] bg-[#0d1117] hover:border-[var(--color-accent)]/60 hover:bg-[#21262d]"
      }`}
    >
      <MonsterTypeSpriteIcon typeId={typeId} size={size} title={label} />
    </button>
  );
}

function numInput(
  label: string,
  value: number | null,
  onChange: (v: number | null) => void
) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
      {label}
      <input
        type="number"
        className="rounded-md border border-[var(--color-border)] bg-[#0d1117] px-2 py-1 text-sm text-white transition-colors focus:border-[var(--color-accent)] focus:outline-none"
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
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/50 bg-[#1f3a5f] px-2 py-0.5 text-[10px] text-[var(--color-accent)] hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-300"
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
                className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-accent)]/50 bg-[#1f3a5f] p-0.5 hover:border-red-500/50 hover:bg-red-950/40"
                title={`${ATTRIBUTE_SLOT_LABELS[slotIndex]}: ${label} — click to remove`}
                aria-label={`Remove ${ATTRIBUTE_SLOT_LABELS[slotIndex]} ${label} filter`}
              >
                <MonsterAttributeSpriteIcon
                  attributeId={id}
                  size={16}
                  title={label}
                />
                <span
                  className="px-0.5 text-[10px] text-[var(--color-accent)]"
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
            className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-accent)]/50 bg-[#1f3a5f] p-0.5 hover:border-red-500/50 hover:bg-red-950/40"
            title={`${label} — click to remove`}
            aria-label={`Remove ${label} filter`}
          >
            <MonsterTypeSpriteIcon typeId={id} size={16} title={label} />
            <span
              className="px-0.5 text-[10px] text-[var(--color-accent)]"
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
      defaultOpen
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
              <p className="mb-1 text-[10px] font-medium text-[var(--color-muted)]">
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
  const summary = filters.idQuery.trim() ? "search active" : "monster_id, NA#, name";

  return (
    <CollapsibleFilterSection
      title="ID / NA# / name"
      summary={summary}
      compact={compact}
      defaultOpen={false}
    >
      <input
        type="search"
        placeholder="monster_id, NA#, name…"
        className={`w-full rounded-md border border-[var(--color-border)] bg-[#0d1117] text-white transition-colors focus:border-[var(--color-accent)] focus:outline-none ${
          compact ? "px-2 py-1 text-xs" : "px-2 py-1.5 text-sm"
        }`}
        value={filters.idQuery}
        onChange={(e) => onChange({ ...filters, idQuery: e.target.value })}
      />
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
      className="shrink-0 rounded border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)] hover:border-red-500/50 hover:text-red-300"
    >
      Clear all
    </button>
  );
}
