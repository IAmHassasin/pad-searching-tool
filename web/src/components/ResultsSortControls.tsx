import { useState } from "react";
import {
  DEFAULT_AWK_MODIFIER_SETTINGS,
  type AwkModifierSettings,
} from "../lib/awakening-stat-modifier";
import {
  needsAwkModifierForSort,
  RESULT_SORT_OPTIONS,
  type ResultSortOption,
} from "../lib/results-sort";
import { AwkModifierModal } from "./AwkModifierModal";

type Props = {
  sort: ResultSortOption;
  onSortChange: (sort: ResultSortOption) => void;
  awkSettings: AwkModifierSettings;
  onAwkSettingsChange: (next: AwkModifierSettings) => void;
  compact?: boolean;
};

export function ResultsSortControls({
  sort,
  onSortChange,
  awkSettings,
  onAwkSettingsChange,
  compact = false,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const showAwkButton = needsAwkModifierForSort(sort);
  const enabledCount = awkSettings.enabled.length;
  const modifierStat =
    sort === "hp_modified"
      ? "hp"
      : sort === "atk_modified"
        ? "atk"
        : "rcv";

  return (
    <>
      <div
        className={`flex items-center gap-2 ${compact ? "flex-wrap" : ""}`}
      >
        <label className="flex items-center gap-1.5 text-[10px] text-[var(--color-muted)]">
          <span className="shrink-0">Sort</span>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as ResultSortOption)}
            className="max-w-[10rem] rounded border border-[var(--color-border)] bg-[#0d1117] px-1.5 py-0.5 text-[10px] text-white"
          >
            {RESULT_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {showAwkButton && (
          <button
            type="button"
            title="Awk modifier"
            aria-label={`Awk modifier${enabledCount > 0 ? ` (${enabledCount} selected)` : ""}`}
            onClick={() => setModalOpen(true)}
            className={`rounded border p-1 transition-colors ${
              enabledCount > 0
                ? "border-[#6b8f3c] bg-[#1a2a12] text-[#a8c878]"
                : "border-amber-600/70 bg-amber-950/30 text-amber-300"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61a.25.25 0 0 1-.128.057l-3.5.75a.25.25 0 0 1-.303-.303l.75-3.5a.25.25 0 0 1 .057-.128l8.61-8.61Z" />
              <path d="m10.273 2.205 1.522 1.522-8.61 8.61-1.522-1.522 8.61-8.61Z" />
            </svg>
          </button>
        )}
      </div>

      <AwkModifierModal
        open={modalOpen}
        stat={modifierStat}
        settings={awkSettings}
        onChange={onAwkSettingsChange}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

export { DEFAULT_AWK_MODIFIER_SETTINGS };
