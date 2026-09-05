import type { AwkModifierSettings } from "../lib/awakening-stat-modifier";
import type { ResultDisplaySections } from "../lib/result-display";
import type { ResultQuickFilter } from "../lib/result-quick-filter";
import type { ResultSortOption } from "../lib/results-sort";
import type { MonsterRecord } from "../types";
import { MonsterDetailPanel } from "./MonsterDetailPanel";
import { ResultsDisplayControls } from "./ResultsDisplayControls";
import { ResultsList } from "./ResultsList";
import { ResultsQuickFilter } from "./ResultsQuickFilter";
import { ResultsSortControls } from "./ResultsSortControls";

type Props = {
  rows: MonsterRecord[];
  totalLoaded: number;
  selected: MonsterRecord | null;
  onSelect: (row: MonsterRecord | null) => void;
  loading: boolean;
  loadProgress: number | null;
  resultSort: ResultSortOption;
  onResultSortChange: (sort: ResultSortOption) => void;
  awkModifierSettings: AwkModifierSettings;
  onAwkModifierSettingsChange: (next: AwkModifierSettings) => void;
  displaySections: ResultDisplaySections;
  onDisplaySectionsChange: (next: ResultDisplaySections) => void;
  resultQuickFilter: ResultQuickFilter;
  onResultQuickFilterChange: (next: ResultQuickFilter) => void;
};

export function ResultsPanel({
  rows,
  totalLoaded,
  selected,
  onSelect,
  loading,
  loadProgress,
  resultSort,
  onResultSortChange,
  awkModifierSettings,
  onAwkModifierSettingsChange,
  displaySections,
  onDisplaySectionsChange,
  resultQuickFilter,
  onResultQuickFilterChange,
}: Props) {
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2">
        <div className="flex items-center gap-1">
          <h2 className="text-sm font-semibold tracking-wide [font-family:var(--font-mono)]">
            Results
          </h2>
          <ResultsQuickFilter
            value={resultQuickFilter}
            onChange={onResultQuickFilterChange}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ResultsDisplayControls
            sections={displaySections}
            onSectionsChange={onDisplaySectionsChange}
          />
          <ResultsSortControls
            sort={resultSort}
            onSortChange={onResultSortChange}
            awkSettings={awkModifierSettings}
            onAwkSettingsChange={onAwkModifierSettingsChange}
          />
          <p className="flex items-center gap-1.5 text-xs tabular-nums text-[var(--color-muted)] [font-family:var(--font-mono)]">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                loading
                  ? "animate-pulse bg-[var(--color-accent-2)]"
                  : "bg-[var(--color-accent)]"
              }`}
              aria-hidden
            />
            {loading
              ? `loading… ${loadProgress ?? 0}`
              : `${rows.length} shown · ${totalLoaded} loaded`}
          </p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="min-h-0 overflow-auto border-b border-[var(--color-border)] lg:border-b-0 lg:border-r">
          <ResultsList
            rows={rows}
            selected={selected}
            onSelect={onSelect}
            loading={loading}
            resultSort={resultSort}
            displaySections={displaySections}
          />
        </div>

        <div className="relative flex min-h-0 items-stretch justify-center overflow-auto bg-[#0a0e12] p-3">
          {selected ? (
            <MonsterDetailPanel row={selected} onSelect={onSelect} />
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
