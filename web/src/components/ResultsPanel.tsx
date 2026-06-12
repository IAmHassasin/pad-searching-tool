import type { MonsterRecord } from "../types";
import { MonsterDetailCard } from "./MonsterDetailCard";
import { ResultsList } from "./ResultsList";

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
          <ResultsList
            rows={rows}
            selected={selected}
            onSelect={onSelect}
            loading={loading}
          />
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
