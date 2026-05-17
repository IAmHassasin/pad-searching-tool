import { monsterRowId } from "../lib/filters";
import type { MonsterRecord } from "../types";

type Props = {
  rows: MonsterRecord[];
  totalLoaded: number;
  selected: MonsterRecord | null;
  onSelect: (row: MonsterRecord | null) => void;
  loading: boolean;
  loadProgress: number | null;
};

export function ResultsPanel({
  rows,
  totalLoaded,
  selected,
  onSelect,
  loading,
  loadProgress,
}: Props) {
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2">
        <h2 className="text-sm font-semibold">Results</h2>
        <p className="text-xs text-[var(--color-muted)]">
          {loading
            ? `Loading monsters… ${loadProgress ?? 0}`
            : `${rows.length} shown · ${totalLoaded} loaded`}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="min-h-0 overflow-auto border-b border-[var(--color-border)] lg:border-b-0 lg:border-r">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#21262d] text-[var(--color-muted)]">
              <tr>
                <th className="px-2 py-1.5">ID</th>
                <th className="px-2 py-1.5">NA#</th>
                <th className="px-2 py-1.5">Name</th>
                <th className="px-2 py-1.5">★</th>
                <th className="px-2 py-1.5">HP</th>
                <th className="px-2 py-1.5">ATK</th>
                <th className="px-2 py-1.5">RCV</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 2000).map((row) => {
                const id = monsterRowId(row);
                const active = selected && monsterRowId(selected) === id;
                return (
                  <tr
                    key={id}
                    onClick={() => onSelect(row)}
                    className={`cursor-pointer border-t border-[var(--color-border)] hover:bg-[#21262d] ${active ? "bg-[#1f3a5f]" : ""}`}
                  >
                    <td className="px-2 py-1 font-mono">{id}</td>
                    <td className="px-2 py-1 font-mono">
                      {row.monster_no_na ?? "—"}
                    </td>
                    <td className="max-w-[12rem] truncate px-2 py-1">
                      {row.name_en ?? "—"}
                    </td>
                    <td className="px-2 py-1">{row.rarity ?? "—"}</td>
                    <td className="px-2 py-1">{row.hp_max ?? "—"}</td>
                    <td className="px-2 py-1">{row.atk_max ?? "—"}</td>
                    <td className="px-2 py-1">{row.rcv_max ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 2000 && (
            <p className="p-2 text-xs text-[var(--color-muted)]">
              Showing first 2000 of {rows.length} matches.
            </p>
          )}
          {!loading && rows.length === 0 && (
            <p className="p-4 text-sm text-[var(--color-muted)]">
              No monsters match the current filters.
            </p>
          )}
        </div>

        <div className="min-h-0 overflow-auto p-3">
          {selected ? (
            <MonsterDetail row={selected} />
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              Select a row to view details.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function MonsterDetail({ row }: { row: MonsterRecord }) {
  const fields: [string, unknown][] = [
    ["monster_id", row.monster_id ?? row.__source_pk],
    ["monster_no_na", row.monster_no_na],
    ["name_en", row.name_en],
    ["name_jp", row.name_jp],
    ["rarity", row.rarity],
    ["hp_max", row.hp_max],
    ["atk_max", row.atk_max],
    ["rcv_max", row.rcv_max],
    ["attribute_1_id", row.attribute_1_id],
    ["attribute_2_id", row.attribute_2_id],
    ["attribute_3_id", row.attribute_3_id],
  ];

  return (
    <article className="space-y-3">
      <h3 className="text-base font-semibold">
        {row.name_en ?? "Unknown"}{" "}
        <span className="font-mono text-sm text-[var(--color-muted)]">
          #{monsterRowId(row)}
        </span>
      </h3>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {fields.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[var(--color-muted)]">{k}</dt>
            <dd className="font-mono">{String(v ?? "—")}</dd>
          </div>
        ))}
      </dl>
      <section>
        <h4 className="mb-1 text-xs font-medium text-[var(--color-accent)]">
          Active skill
        </h4>
        <p className="whitespace-pre-wrap rounded border border-[var(--color-border)] bg-[#0d1117] p-2 text-xs leading-relaxed">
          {row.active_skill_desc_en?.trim() || "—"}
        </p>
      </section>
      <section>
        <h4 className="mb-1 text-xs font-medium text-[var(--color-accent)]">
          Leader skill
        </h4>
        <p className="whitespace-pre-wrap rounded border border-[var(--color-border)] bg-[#0d1117] p-2 text-xs leading-relaxed">
          {row.leader_skill_desc_en?.trim() || "—"}
        </p>
      </section>
    </article>
  );
}
