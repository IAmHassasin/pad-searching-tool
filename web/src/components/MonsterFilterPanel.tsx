import type { MonsterFilters } from "../types";

const RARITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ATTRIBUTES = [
  { id: 1, label: "Fire" },
  { id: 2, label: "Water" },
  { id: 3, label: "Wood" },
  { id: 4, label: "Light" },
  { id: 5, label: "Dark" },
];

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

function numInput(
  label: string,
  value: number | null,
  onChange: (v: number | null) => void
) {
  return (
    <label className="flex flex-col gap-0.5 text-xs text-[var(--color-muted)]">
      {label}
      <input
        type="number"
        className="rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1 text-sm text-white"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
      />
    </label>
  );
}

export function MonsterFilterPanel({ filters, onChange }: Props) {
  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <h2 className="text-sm font-semibold tracking-wide text-[var(--color-accent)]">
        Monster
      </h2>

      <section>
        <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">
          Rarity
        </p>
        <div className="flex flex-wrap gap-1">
          {RARITIES.map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-1 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-xs has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[#1f3a5f]"
            >
              <input
                type="checkbox"
                className="accent-[var(--color-accent)]"
                checked={filters.rarity.has(r)}
                onChange={() =>
                  onChange({
                    ...filters,
                    rarity: toggleSet(filters.rarity, r),
                  })
                }
              />
              {r}★
            </label>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">
          Attribute (any slot)
        </p>
        <div className="flex flex-wrap gap-1">
          {ATTRIBUTES.map(({ id, label }) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-1 rounded border border-[var(--color-border)] px-2 py-0.5 text-xs has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[#1f3a5f]"
            >
              <input
                type="checkbox"
                checked={filters.attributes.has(id)}
                onChange={() =>
                  onChange({
                    ...filters,
                    attributes: toggleSet(filters.attributes, id),
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
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
      </section>

      <section>
        <label className="flex flex-col gap-0.5 text-xs text-[var(--color-muted)]">
          ID / NA# / name
          <input
            type="search"
            placeholder="monster_id, NA#, name…"
            className="rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1.5 text-sm text-white"
            value={filters.idQuery}
            onChange={(e) =>
              onChange({ ...filters, idQuery: e.target.value })
            }
          />
        </label>
      </section>
    </aside>
  );
}
