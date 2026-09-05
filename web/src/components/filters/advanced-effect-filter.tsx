import {
  countAdvancedEffectFilters,
  EMPTY_ADVANCED_EFFECT_FILTERS,
  type AdvancedEffectFilters,
  type EffectFamilyDef,
  type EffectFamilyId,
} from "../../types";
import { CATEGORY_ACCENT } from "./skill-pattern-shared";
import { CollapsibleFilterSection } from "./collapsible-filter-section";

/** Group → accent, reusing the skill-pattern palette for visual continuity. */
const GROUP_ACCENT: Record<EffectFamilyDef["group"], string> = {
  active: CATEGORY_ACCENT.as_mechanics_utility,
  leader: CATEGORY_ACCENT.ls_stat_multipliers,
  both: CATEGORY_ACCENT.ls_condition_buffs,
};

const GROUP_LABEL: Record<EffectFamilyDef["group"], string> = {
  active: "Active skill",
  leader: "Leader skill",
  both: "Active + leader",
};

const GROUP_ORDER: EffectFamilyDef["group"][] = ["both", "active", "leader"];

function rangeOf(filters: AdvancedEffectFilters, id: EffectFamilyId) {
  return filters.ranges[id] ?? { min: null, max: null };
}

function setRange(
  filters: AdvancedEffectFilters,
  id: EffectFamilyId,
  patch: { min?: number | null; max?: number | null }
): AdvancedEffectFilters {
  const current = rangeOf(filters, id);
  const next = { ...current, ...patch };
  const ranges = { ...filters.ranges };
  if (next.min == null && next.max == null) delete ranges[id];
  else ranges[id] = next;
  return { ranges };
}

function BoundInput({
  label,
  value,
  step,
  placeholder,
  onChange,
  compact,
}: {
  label: string;
  value: number | null;
  step?: number;
  placeholder?: string;
  onChange: (v: number | null) => void;
  compact: boolean;
}) {
  return (
    <label
      className={`flex min-w-0 flex-1 flex-col gap-0.5 font-medium uppercase tracking-wide text-[var(--color-muted)] ${
        compact ? "text-[8px]" : "text-[9px]"
      }`}
    >
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={step ?? "any"}
        placeholder={placeholder}
        className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] px-1.5 tabular-nums text-white transition-colors placeholder:text-[var(--color-muted)]/50 focus:border-[var(--color-accent)] focus:outline-none ${
          compact ? "py-0.5 text-[11px]" : "py-1 text-xs"
        }`}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : null);
        }}
      />
    </label>
  );
}

function FamilyRow({
  family,
  filters,
  onChange,
  compact,
}: {
  family: EffectFamilyDef;
  filters: AdvancedEffectFilters;
  onChange: (next: AdvancedEffectFilters) => void;
  compact: boolean;
}) {
  const range = rangeOf(filters, family.id);
  const active = range.min != null || range.max != null;
  const accent = GROUP_ACCENT[family.group] ?? "var(--color-accent)";
  const observed =
    family.min_observed != null && family.max_observed != null
      ? `${family.min_observed}–${family.max_observed}${family.unit}`
      : null;

  return (
    <div
      className={`rounded-md border p-1.5 transition-colors ${
        active
          ? "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)]/30"
          : "border-[var(--color-border)]/70"
      }`}
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p
          className={`min-w-0 truncate font-semibold ${compact ? "text-[10px]" : "text-[11px]"}`}
          style={{ color: accent }}
          title={family.label}
        >
          {family.label}
        </p>
        <div className="flex shrink-0 items-baseline gap-1.5">
          {observed && (
            <span
              className={`tabular-nums text-[var(--color-muted)] ${compact ? "text-[8px]" : "text-[9px]"}`}
              title={
                family.cards_observed != null
                  ? `${family.cards_observed} cards have this effect`
                  : undefined
              }
            >
              {observed}
            </span>
          )}
          {active && (
            <button
              type="button"
              onClick={() => onChange(setRange(filters, family.id, { min: null, max: null }))}
              className="rounded px-1 text-[9px] text-[var(--color-muted)] hover:text-red-300"
              title={`Clear ${family.label}`}
              aria-label={`Clear ${family.label}`}
            >
              ×
            </button>
          )}
        </div>
      </div>
      <div className="flex items-end gap-1.5">
        <BoundInput
          label={`min ${family.unit}`}
          value={range.min}
          step={family.step}
          placeholder={family.min_observed != null ? String(family.min_observed) : undefined}
          compact={compact}
          onChange={(min) => onChange(setRange(filters, family.id, { min }))}
        />
        <span
          className={`pb-1 text-[var(--color-muted)] ${compact ? "text-[9px]" : "text-[10px]"}`}
          aria-hidden
        >
          –
        </span>
        <BoundInput
          label={`max ${family.unit}`}
          value={range.max}
          step={family.step}
          placeholder={family.max_observed != null ? String(family.max_observed) : undefined}
          compact={compact}
          onChange={(max) => onChange(setRange(filters, family.id, { max }))}
        />
      </div>
    </div>
  );
}

/**
 * Numeric skill-effect-value filters — shield %, xN HP, charge turns, …
 * Families come from `GET /patterns/effect-families`; the server extracts the
 * number out of the skill description with each family's regex.
 */
export function AdvancedEffectFilterSection({
  filters,
  onChange,
  families,
  loading = false,
  compact = false,
}: {
  filters: AdvancedEffectFilters;
  onChange: (next: AdvancedEffectFilters) => void;
  families: EffectFamilyDef[] | undefined;
  loading?: boolean;
  compact?: boolean;
}) {
  const activeCount = countAdvancedEffectFilters(filters);
  const list = families ?? [];
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    families: list.filter((f) => f.group === group),
  })).filter((g) => g.families.length > 0);

  return (
    <CollapsibleFilterSection
      title="Effect values"
      summary={
        activeCount > 0
          ? `${activeCount} range${activeCount === 1 ? "" : "s"}`
          : `${list.length} numeric filters`
      }
      compact={compact}
      defaultOpen={activeCount > 0}
      headerExtra={
        activeCount > 0 ? (
          <button
            type="button"
            onClick={() => onChange(EMPTY_ADVANCED_EFFECT_FILTERS)}
            className="shrink-0 rounded border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)] hover:border-red-500/50 hover:text-red-300"
          >
            Clear all
          </button>
        ) : undefined
      }
    >
      {loading && (
        <p className="text-[10px] text-[var(--color-muted)]">Loading families…</p>
      )}
      {!loading && list.length === 0 && (
        <p className="text-[10px] text-[var(--color-muted)]">
          No effect-value families configured.
        </p>
      )}
      {list.length > 0 && (
        <>
          <p
            className={`mb-2 text-[var(--color-muted)] ${compact ? "text-[9px]" : "text-[10px]"}`}
          >
            Filter by the actual number in the skill text — e.g. shield ≥ 50%,
            HP ≥ 3x, charge 2–3 turns. Leave a side empty for no bound.
          </p>
          <div className="space-y-2">
            {grouped.map(({ group, families: groupFamilies }) => (
              <div key={group}>
                <p
                  className={`mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-wide ${compact ? "text-[9px]" : "text-[10px]"}`}
                  style={{ color: GROUP_ACCENT[group] }}
                >
                  <span
                    className="h-px w-2 shrink-0"
                    style={{ backgroundColor: GROUP_ACCENT[group] }}
                    aria-hidden
                  />
                  {GROUP_LABEL[group]}
                </p>
                <div className="space-y-1.5">
                  {groupFamilies.map((family) => (
                    <FamilyRow
                      key={family.id}
                      family={family}
                      filters={filters}
                      onChange={onChange}
                      compact={compact}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </CollapsibleFilterSection>
  );
}
