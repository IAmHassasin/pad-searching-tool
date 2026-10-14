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
        className={`flex items-center gap-1.5 ${compact ? "shrink-0" : "flex-wrap"}`}
      >
        <label className="flex items-center gap-1.5">
          <span className="ds-label shrink-0">Sort</span>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as ResultSortOption)}
            className={`ds-input max-w-[10rem] px-1.5 py-0.5 text-[10px] ${
              sort !== "default" ? "border-[var(--color-accent)]/60" : ""
            }`}
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
            className={`pressable rounded-lg border p-1.5 ${
              enabledCount > 0
                ? "border-[var(--color-positive)]/60 bg-emerald-500/10 text-emerald-300"
                : "border-[var(--color-accent)]/60 bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)] shadow-[var(--shadow-glow)]"
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
