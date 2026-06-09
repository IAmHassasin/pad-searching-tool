import { EMPTY_MONSTER_FILTERS, type MonsterFilters } from "../types";

const RARITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const ATTRIBUTES = [
  { id: 0, label: "Fire", accent: "#f85149" },
  { id: 1, label: "Water", accent: "#58a6ff" },
  { id: 2, label: "Wood", accent: "#3fb950" },
  { id: 3, label: "Light", accent: "#d29922" },
  { id: 4, label: "Dark", accent: "#a371f7" },
] as const;

const RARITY_ACCENT = "#d29922";

type Props = {
  filters: MonsterFilters;
  onChange: (next: MonsterFilters) => void;
};

function toggleSet(set: Set<number>, n: number): Set<number> {
  const next = new Set(set);
  if (next.has(n)) next.delete(n);
  else next.add(n);
  return next;
}

function FilterChip({
  label,
  selected,
  accent,
  onToggle,
}: {
  label: string;
  selected: boolean;
  accent: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-[11px] leading-tight transition-colors ${
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

function hasActiveFilters(filters: MonsterFilters): boolean {
  return (
    filters.rarity.size > 0 ||
    filters.attributes.size > 0 ||
    filters.hpMin != null ||
    filters.hpMax != null ||
    filters.atkMin != null ||
    filters.atkMax != null ||
    filters.rcvMin != null ||
    filters.rcvMax != null ||
    filters.idQuery.trim().length > 0
  );
}

export function MonsterFilterPanel({ filters, onChange }: Props) {
  const active = hasActiveFilters(filters);

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)]">
        Monster
      </h2>

      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] text-[var(--color-muted)]/80">
          Tap chips to filter stats & attributes
        </p>
        {active && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_MONSTER_FILTERS)}
            className="shrink-0 rounded border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)] hover:border-red-500/50 hover:text-red-300"
          >
            Clear all
          </button>
        )}
      </div>

      {(filters.rarity.size > 0 || filters.attributes.size > 0) && (
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
          {ATTRIBUTES.filter(({ id }) => filters.attributes.has(id)).map(
            ({ id, label }) => (
              <button
                key={`a-${id}`}
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    attributes: toggleSet(filters.attributes, id),
                  })
                }
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/50 bg-[#1f3a5f] px-2 py-0.5 text-[10px] text-[var(--color-accent)] hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-300"
                title="Click to remove"
              >
                {label}
                <span aria-hidden>×</span>
              </button>
            )
          )}
        </div>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold text-white">Rarity</p>
          <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
            {filters.rarity.size > 0
              ? `${filters.rarity.size} / ${RARITIES.length} selected`
              : `${RARITIES.length} tiers`}
          </span>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[#0d1117]/60 p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {RARITIES.map((r) => (
              <FilterChip
                key={r}
                label={`${r}★`}
                selected={filters.rarity.has(r)}
                accent={RARITY_ACCENT}
                onToggle={() =>
                  onChange({
                    ...filters,
                    rarity: toggleSet(filters.rarity, r),
                  })
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold text-white">Attribute</p>
          <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
            {filters.attributes.size > 0
              ? `${filters.attributes.size} / ${ATTRIBUTES.length} selected`
              : "any slot"}
          </span>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[#0d1117]/60 p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {ATTRIBUTES.map(({ id, label, accent }) => (
              <FilterChip
                key={id}
                label={label}
                selected={filters.attributes.has(id)}
                accent={accent}
                onToggle={() =>
                  onChange({
                    ...filters,
                    attributes: toggleSet(filters.attributes, id),
                  })
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--color-border)] pt-3">
        <p className="mb-2 text-xs font-semibold text-white">Stats range</p>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--color-border)] bg-[#0d1117]/60 p-2.5">
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
      </section>

      <section>
        <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">
          ID / NA# / name
        </p>
        <input
          type="search"
          placeholder="monster_id, NA#, name…"
          className="w-full rounded-md border border-[var(--color-border)] bg-[#0d1117] px-2 py-1.5 text-sm text-white transition-colors focus:border-[var(--color-accent)] focus:outline-none"
          value={filters.idQuery}
          onChange={(e) =>
            onChange({ ...filters, idQuery: e.target.value })
          }
        />
      </section>
    </aside>
  );
}
