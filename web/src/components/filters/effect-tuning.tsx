import { EffectFilterSpriteIcon } from "../EffectFilterSpriteIcon";
import { hasEffectFilterIcon } from "../../lib/effect-filter-sprite";
import {
  EMPTY_EFFECT_VALUE_RANGE,
  activeLoopCopies,
  effectRangeKey,
  familiesForTag,
  type AdvancedEffectFilters,
  type EffectFamilyDef,
  type EffectRangeKey,
  type EffectValueRange,
  type LoopCopyCount,
  type SelectedPatternTag,
  type SkillFilters,
} from "../../types";

type SkillType = SelectedPatternTag["skillType"];

function rangeOf(
  filters: AdvancedEffectFilters,
  key: EffectRangeKey
): EffectValueRange {
  return { ...EMPTY_EFFECT_VALUE_RANGE, ...filters.ranges[key] };
}

function setRange(
  filters: AdvancedEffectFilters,
  key: EffectRangeKey,
  patch: Partial<EffectValueRange>
): AdvancedEffectFilters {
  const next = { ...rangeOf(filters, key), ...patch };
  const ranges = { ...filters.ranges };
  if (
    next.min == null &&
    next.max == null &&
    next.turnMin == null &&
    next.turnMax == null &&
    next.loop !== true
  ) {
    delete ranges[key];
  } else {
    ranges[key] = next;
  }
  return { ...filters, ranges };
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
      className={`flex min-w-0 flex-1 flex-col gap-0.5 font-mono font-semibold uppercase tracking-wide text-[var(--color-faint)] ${
        compact ? "text-[8px]" : "text-[9px]"
      }`}
    >
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={step ?? "any"}
        placeholder={placeholder}
        className={`ds-input w-full px-1.5 font-mono font-medium normal-case tabular-nums tracking-normal transition-colors ${
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

/** Labelled min – max input pair. */
function RangeRow({
  label,
  unit,
  min,
  max,
  step,
  minPlaceholder,
  maxPlaceholder,
  onChange,
  compact,
}: {
  label: string;
  unit: string;
  min: number | null;
  max: number | null;
  step?: number;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  onChange: (patch: { min?: number | null; max?: number | null }) => void;
  compact: boolean;
}) {
  return (
    <div className="flex items-end gap-1.5">
      <span
        className={`w-12 shrink-0 pb-1 font-semibold text-[var(--color-muted)] ${
          compact ? "text-[9px]" : "text-[10px]"
        }`}
      >
        {label}
      </span>
      <BoundInput
        label={`min ${unit}`.trim()}
        value={min}
        step={step}
        placeholder={minPlaceholder}
        compact={compact}
        onChange={(v) => onChange({ min: v })}
      />
      <span
        className={`pb-1 text-[var(--color-faint)] ${compact ? "text-[9px]" : "text-[10px]"}`}
        aria-hidden
      >
        –
      </span>
      <BoundInput
        label={`max ${unit}`.trim()}
        value={max}
        step={step}
        placeholder={maxPlaceholder}
        compact={compact}
        onChange={(v) => onChange({ max: v })}
      />
    </div>
  );
}

/** Active skill CD at max skill level. One bound alone filters "equals". */
export function ActiveSkillCooldownField({
  filters,
  onChange,
  compact = false,
}: {
  filters: SkillFilters;
  onChange: (next: SkillFilters) => void;
  compact?: boolean;
}) {
  const single =
    (filters.activeCdMin == null) !== (filters.activeCdMax == null);
  return (
    <div className="mb-3 rounded-lg border border-white/[0.06] bg-[var(--color-inset)]/50 p-1.5">
      <RangeRow
        label="CD"
        unit="turns"
        min={filters.activeCdMin}
        max={filters.activeCdMax}
        step={1}
        compact={compact}
        onChange={(patch) =>
          onChange({
            ...filters,
            ...(patch.min !== undefined ? { activeCdMin: patch.min } : {}),
            ...(patch.max !== undefined ? { activeCdMax: patch.max } : {}),
          })
        }
      />
      <p
        className={`mt-1 text-[var(--color-faint)] ${compact ? "text-[8px]" : "text-[9px]"}`}
      >
        {single
          ? `Exactly ${filters.activeCdMin ?? filters.activeCdMax} turns at max skill level`
          : "CD at max skill level · fill one side for an exact CD"}
      </p>
    </div>
  );
}

const LOOP_COPY_OPTIONS: {
  copies: LoopCopyCount;
  label: string;
  title: string;
  idle: string;
  on: string;
  hint: string;
  box: string;
  check: string;
  text: string;
}[] = [
  {
    copies: 1,
    label: "x1",
    title: "1 copy. The effect lasts at least the charged cooldown.",
    idle: "text-[var(--color-accent-strong)] hover:bg-[var(--color-accent-muted)]",
    on: "bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)] shadow-[var(--shadow-glow)]",
    hint: "Checked Loop effects · 1 copy covers the charged cooldown",
    box: "border-white/[0.06]",
    check: "accent-[var(--color-accent)]",
    text: "text-[var(--color-muted)]",
  },
  {
    copies: 2,
    label: "x2",
    title:
      "2 copies of this active. The effect lasts at least half the charged cooldown, rounded up.",
    idle: "text-[var(--color-secondary-strong)] hover:bg-[var(--color-secondary-muted)]",
    on: "bg-[var(--color-secondary-muted)] text-[var(--color-secondary-strong)] shadow-[var(--shadow-glow-cyan)]",
    hint: "Checked Loop effects · 2 copies cover the charged cooldown",
    box: "border-[var(--color-secondary)]/70",
    check: "accent-[var(--color-secondary)]",
    text: "text-[var(--color-secondary-strong)]",
  },
  {
    copies: 3,
    label: "x3",
    title:
      "3 copies of this active. The effect lasts at least a third of the charged cooldown, rounded up.",
    idle: "text-[var(--color-pad-dark)] hover:bg-[color-mix(in_srgb,var(--color-pad-dark)_16%,transparent)]",
    on: "bg-[color-mix(in_srgb,var(--color-pad-dark)_22%,transparent)] text-[var(--color-pad-dark)]",
    hint: "Checked Loop effects · 3 copies cover the charged cooldown",
    box: "border-[var(--color-pad-dark)]/70",
    check: "accent-[var(--color-pad-dark)]",
    text: "text-[var(--color-pad-dark)]",
  },
];

function loopCopyOption(copies: LoopCopyCount) {
  return LOOP_COPY_OPTIONS.find((option) => option.copies === copies) ?? LOOP_COPY_OPTIONS[0];
}

/** True once any effect's Loop box is checked. The x1/x2/x3 control waits for that. */
export function hasCheckedEffectLoop(filters: AdvancedEffectFilters): boolean {
  return Object.values(filters.ranges).some((range) => range?.loop === true);
}

/**
 * How many copies of the same active are rotated when an effect's Loop box
 * is checked. x1 is one card. x2 and x3 use a different color from x1.
 */
export function ActiveSkillLoopSystemField({
  filters,
  onChange,
  compact = false,
}: {
  filters: AdvancedEffectFilters;
  onChange: (next: AdvancedEffectFilters) => void;
  compact?: boolean;
}) {
  const copies = activeLoopCopies(filters);
  const selected = loopCopyOption(copies);
  return (
    <div
      className={`mb-3 rounded-lg border bg-[var(--color-inset)]/50 p-1.5 ${selected.box}`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`w-12 shrink-0 font-semibold text-[var(--color-muted)] ${
            compact ? "text-[9px]" : "text-[10px]"
          }`}
        >
          Loop
        </span>
        <div
          role="group"
          aria-label="Loop copies"
          className="flex min-w-0 flex-1 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] p-0.5"
        >
          {LOOP_COPY_OPTIONS.map((option) => {
            const active = copies === option.copies;
            return (
              <button
                key={option.copies}
                type="button"
                aria-pressed={active}
                title={option.title}
                onClick={() => {
                  if (active && filters.loopCopies === option.copies) return;
                  onChange({ ...filters, loopCopies: option.copies });
                }}
                className={`pressable flex-1 rounded px-1.5 font-mono font-semibold tracking-wide ${
                  compact ? "py-0.5 text-[10px]" : "py-0.5 text-[11px]"
                } ${active ? option.on : option.idle}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <p
        className={`mt-1 text-[var(--color-faint)] ${compact ? "text-[8px]" : "text-[9px]"}`}
      >
        {selected.hint}
      </p>
    </div>
  );
}

function FamilyTuning({
  family,
  skillType,
  filters,
  onChange,
  showLabel,
  compact,
}: {
  family: EffectFamilyDef;
  skillType: SkillType;
  filters: AdvancedEffectFilters;
  onChange: (next: AdvancedEffectFilters) => void;
  showLabel: boolean;
  compact: boolean;
}) {
  const key = effectRangeKey(family.id, skillType);
  const range = rangeOf(filters, key);
  const showValue = family.supports_value !== false;
  // Durations ("For N turns, …") only exist in active skill text.
  const showTurns = family.supports_turns === true && skillType === "active_skill";
  const loopSystem = loopCopyOption(activeLoopCopies(filters));
  if (!showValue && !showTurns) return null;

  return (
    <div className="space-y-1">
      {showLabel && (
        <p
          className={`font-semibold text-[var(--color-muted)] ${compact ? "text-[9px]" : "text-[10px]"}`}
        >
          {family.label}
        </p>
      )}
      {showValue && (
        <RangeRow
          label="Value"
          unit={family.unit}
          min={range.min}
          max={range.max}
          step={family.step}
          minPlaceholder={
            family.min_observed != null ? String(family.min_observed) : undefined
          }
          maxPlaceholder={
            family.max_observed != null ? String(family.max_observed) : undefined
          }
          compact={compact}
          onChange={(patch) => onChange(setRange(filters, key, patch))}
        />
      )}
      {showTurns && (
        <RangeRow
          label="By turn"
          unit="turns"
          min={range.turnMin}
          max={range.turnMax}
          step={1}
          compact={compact}
          onChange={(patch) =>
            onChange(
              setRange(filters, key, {
                ...(patch.min !== undefined ? { turnMin: patch.min } : {}),
                ...(patch.max !== undefined ? { turnMax: patch.max } : {}),
              })
            )
          }
        />
      )}
      {showTurns && skillType === "active_skill" && (
        <label
          className={`flex cursor-pointer items-center gap-1.5 ${
            compact ? "text-[9px]" : "text-[10px]"
          }`}
          title="Keep this effect up with the loop system above. x1 is one card. x2 and x3 rotate that many copies; each copy charges on its own. Evolving skills use that stage's CD. Awakening 51 charges +1 per turn, 97 charges +2. Regular skill-charge copies stack; only the stronger super awakening counts."
        >
          <input
            type="checkbox"
            checked={range.loop === true}
            onChange={(e) =>
              onChange(setRange(filters, key, { loop: e.target.checked }))
            }
            className={loopSystem.check}
          />
          <span className={`font-semibold ${loopSystem.text}`}>Loop</span>
        </label>
      )}
    </div>
  );
}

/**
 * Value / duration inputs for each selected effect chip of one skill type —
 * e.g. selecting Damage Reduction shows "Value min–max %" and "By turn".
 * Chips without a numeric family are skipped.
 */
export function SelectedEffectTuning({
  skillType,
  skillFilters,
  effectFilters,
  onEffectFiltersChange,
  families,
  compact = false,
}: {
  skillType: SkillType;
  skillFilters: SkillFilters;
  effectFilters: AdvancedEffectFilters;
  onEffectFiltersChange: (next: AdvancedEffectFilters) => void;
  families: EffectFamilyDef[] | undefined;
  compact?: boolean;
}) {
  const cards = skillFilters.selectedPatterns
    .filter((p) => p.skillType === skillType)
    .map((p) => ({
      pattern: p,
      families: familiesForTag(families, skillType, p.tagKey).filter(
        (f) =>
          f.supports_value !== false ||
          (f.supports_turns === true && skillType === "active_skill")
      ),
    }))
    .filter((c) => c.families.length > 0);

  if (!cards.length) return null;

  const showLoopSystem =
    skillType === "active_skill" && hasCheckedEffectLoop(effectFilters);

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-2">
      <p className={`ds-label mb-1.5 ${compact ? "text-[9px]" : "text-[10px]"}`}>
        Selected effects
      </p>
      {showLoopSystem && (
        <ActiveSkillLoopSystemField
          filters={effectFilters}
          onChange={onEffectFiltersChange}
          compact={compact}
        />
      )}
      <div className="space-y-1.5">
        {cards.map(({ pattern, families: cardFamilies }) => {
          const keys = cardFamilies.map((f) => effectRangeKey(f.id, skillType));
          const active = keys.some((k) => effectFilters.ranges[k] != null);
          const label = pattern.label ?? pattern.tagKey;
          const clear = () => {
            const ranges = { ...effectFilters.ranges };
            for (const k of keys) delete ranges[k];
            onEffectFiltersChange({ ...effectFilters, ranges });
          };
          return (
            <div
              key={`${skillType}-${pattern.tagKey}`}
              className={`rounded-lg border p-1.5 transition-colors ${
                active
                  ? "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)]"
                  : "border-white/[0.06] bg-[var(--color-inset)]/50"
              }`}
            >
              <div className="mb-1 flex items-center gap-1.5">
                {hasEffectFilterIcon(label) && (
                  <EffectFilterSpriteIcon label={label} size={compact ? 18 : 20} />
                )}
                <p
                  className={`min-w-0 flex-1 truncate font-semibold text-[var(--color-fg-strong)] ${
                    compact ? "text-[10px]" : "text-[11px]"
                  }`}
                  title={label}
                >
                  {label}
                </p>
                {active && (
                  <button
                    type="button"
                    onClick={clear}
                    className="pressable rounded px-1 text-[10px] text-[var(--color-muted)] hover:bg-[var(--color-negative)]/10 hover:text-[var(--color-negative)]"
                    title={`Clear ${label} values`}
                    aria-label={`Clear ${label} values`}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {cardFamilies.map((family) => (
                  <FamilyTuning
                    key={family.id}
                    family={family}
                    skillType={skillType}
                    filters={effectFilters}
                    onChange={onEffectFiltersChange}
                    showLabel={cardFamilies.length > 1}
                    compact={compact}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Ranges no selected chip shows: old share links (`effect=familyId:min:max`)
 * or scoped ranges whose chip is not selected. The server still applies
 * them, so keep them visible and removable.
 */
export function UnscopedEffectRangeChips({
  effectFilters,
  onEffectFiltersChange,
  families,
  selectedPatterns,
}: {
  effectFilters: AdvancedEffectFilters;
  onEffectFiltersChange: (next: AdvancedEffectFilters) => void;
  families: EffectFamilyDef[] | undefined;
  selectedPatterns: SelectedPatternTag[];
}) {
  const shown = new Set<EffectRangeKey>();
  for (const p of selectedPatterns) {
    for (const f of familiesForTag(families, p.skillType, p.tagKey)) {
      shown.add(effectRangeKey(f.id, p.skillType));
    }
  }
  const entries = Object.entries(effectFilters.ranges).filter(
    ([key, r]) => r != null && !shown.has(key)
  );
  if (!entries.length) return null;

  const describe = (key: string, r: EffectValueRange) => {
    const family = families?.find((f) => f.id === key.split("@")[0]);
    const unit = family?.unit ?? "";
    const bound = (min: number | null, max: number | null, u: string) =>
      min != null && max != null
        ? `${min}–${max}${u}`
        : min != null
          ? `≥${min}${u}`
          : max != null
            ? `≤${max}${u}`
            : null;
    return [
      family?.label ?? key,
      bound(r.min, r.max, unit),
      bound(r.turnMin, r.turnMax, "T"),
      r.loop ? `loop x${activeLoopCopies(effectFilters)}` : null,
    ]
      .filter(Boolean)
      .join(" ");
  };

  return (
    <div className="mb-2 flex flex-wrap gap-1">
      {entries.map(([key, r]) => {
        const text = describe(key, r!);
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              const ranges = { ...effectFilters.ranges };
              delete ranges[key];
              onEffectFiltersChange({ ...effectFilters, ranges });
            }}
            className="pressable inline-flex items-center gap-1 rounded-full border border-[var(--color-secondary)]/50 bg-[var(--color-secondary-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-secondary-strong)] hover:border-[var(--color-negative)]/60 hover:bg-[var(--color-negative)]/10 hover:text-red-300"
            title={`${text} — click to remove`}
            aria-label={`Remove ${text}`}
          >
            {text}
            <span aria-hidden>×</span>
          </button>
        );
      })}
    </div>
  );
}
