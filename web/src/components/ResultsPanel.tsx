import { monsterRowId } from "../lib/filters";
import type { MonsterRecord } from "../types";
import { MonsterDetailCard } from "./MonsterDetailCard";

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

        <div className="flex min-h-0 items-start justify-center overflow-auto bg-[#0a0e12] p-3">
          {selected ? (
            <MonsterDetailCard row={selected} />
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
