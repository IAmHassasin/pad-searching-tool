import { monsterRowId } from "../lib/filters";
import {
  computeModifiedStat,
  type AwkModifierSettings,
} from "../lib/awakening-stat-modifier";
import {
  hasAnyDisplaySection,
  isAllSectionsEnabled,
  type ResultDisplaySections,
} from "../lib/result-display";
import type { ResultSortOption } from "../lib/results-sort";
import type { MonsterRecord } from "../types";
import { MonsterQuickPreview } from "./MonsterQuickPreview";
import {
  MonsterPreviewInfoButton,
  MonsterResultPreviewFloating,
  useMonsterResultPreview,
} from "./MonsterResultPreviewPopover";

type Props = {
  rows: MonsterRecord[];
  selected: MonsterRecord | null;
  onSelect: (row: MonsterRecord | null) => void;
  loading: boolean;
  compact?: boolean;
  /** Mobile split view: only NA ID and name */
  minimal?: boolean;
  resultSort?: ResultSortOption;
  awkModifierSettings?: AwkModifierSettings;
  displaySections?: ResultDisplaySections;
};

export function ResultsList({
  rows,
  selected,
  onSelect,
  loading,
  compact = false,
  minimal = false,
  resultSort = "default",
  awkModifierSettings,
  displaySections,
}: Props) {
  const {
    preview,
    previewId,
    bindRowPreview,
    openPinnedPreview,
    closePreview,
    hoverCapable,
  } = useMonsterResultPreview();

  const showModifiedHp =
    resultSort === "hp_modified" && awkModifierSettings != null;
  const showModifiedAtk =
    resultSort === "atk_modified" && awkModifierSettings != null;
  const showModifiedRcv =
    resultSort === "rcv_modified" && awkModifierSettings != null;
  const showCd =
    resultSort === "cd_fastest" || resultSort === "cd_longest";
  const showInlineCard =
    displaySections != null && hasAnyDisplaySection(displaySections);

  const formatStat = (
    row: MonsterRecord,
    stat: "hp" | "atk" | "rcv",
    base: number | null | undefined,
    modified: boolean
  ) => {
    if (modified && awkModifierSettings) {
      const v = computeModifiedStat(row, awkModifierSettings, stat);
      if (v >= 0) return Math.round(v).toLocaleString();
    }
    return base?.toLocaleString() ?? "—";
  };

  const formatCd = (row: MonsterRecord) => {
    const min = row.active_skill_cooldown_min;
    const max = row.active_skill_cooldown_max;
    if (min == null && max == null) return "—";
    if (min != null && max != null && min !== max) return `${min}–${max}`;
    return String(min ?? max);
  };

  return (
    <>
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-[#21262d] text-[var(--color-muted)]">
          <tr>
            <th className="w-0 whitespace-nowrap px-1 py-1.5">ID</th>
            <th className={`py-1.5 ${minimal ? "px-1" : "px-2"}`}>Name</th>
            {!compact && !minimal && (
              <>
                <th className="px-2 py-1.5">
                  HP{showModifiedHp ? "*" : ""}
                </th>
                <th className="px-2 py-1.5">
                  ATK{showModifiedAtk ? "*" : ""}
                </th>
                <th className="px-2 py-1.5">
                  RCV{showModifiedRcv ? "*" : ""}
                </th>
                {showCd && <th className="px-2 py-1.5">CD</th>}
              </>
            )}
            {!hoverCapable && (
              <th className={`py-1.5 ${minimal ? "w-6 px-0" : "w-7 px-0.5"}`} />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 2000).map((row) => {
            const id = monsterRowId(row);
            const active = selected && monsterRowId(selected) === id;
            const previewProps = bindRowPreview(row);

            return (
              <tr
                key={id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-t border-[var(--color-border)] outline-none hover:bg-[#21262d] focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset ${active ? "bg-[#1f3a5f]" : ""}`}
                {...previewProps}
              >
                <td
                  className={`w-0 whitespace-nowrap align-top py-1 font-mono tabular-nums ${minimal ? "px-1 text-[10px]" : "px-1 text-xs"}`}
                >
                  {row.monster_no_na ?? "—"}
                </td>
                <td
                  className={`align-top py-1 ${minimal ? "px-1" : compact ? "max-w-[8rem] px-2" : "max-w-[12rem] px-2"}`}
                >
                  <div className="min-w-0">
                    {!(
                      showInlineCard &&
                      displaySections &&
                      isAllSectionsEnabled(displaySections)
                    ) && (
                      <p
                        className={`truncate ${minimal ? "text-[10px]" : ""}`}
                      >
                        {row.name_en ?? "—"}
                      </p>
                    )}
                    {showInlineCard && displaySections && (
                      <MonsterQuickPreview
                        row={row}
                        variant="inline"
                        sections={displaySections}
                      />
                    )}
                  </div>
                </td>
                {!compact && !minimal && (
                  <>
                    <td className="px-2 py-1">
                      {formatStat(row, "hp", row.hp_max, showModifiedHp)}
                    </td>
                    <td className="px-2 py-1">
                      {formatStat(row, "atk", row.atk_max, showModifiedAtk)}
                    </td>
                    <td className="px-2 py-1">
                      {formatStat(row, "rcv", row.rcv_max, showModifiedRcv)}
                    </td>
                    {showCd && (
                      <td className="px-2 py-1 font-mono">{formatCd(row)}</td>
                    )}
                  </>
                )}
                {!hoverCapable && (
                  <td className={`py-1 ${minimal ? "px-0" : "px-0.5"}`}>
                    <MonsterPreviewInfoButton
                      describedBy={
                        preview != null &&
                        monsterRowId(preview.row) === id
                          ? previewId
                          : undefined
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (preview?.row === row && preview.pinned) {
                          closePreview();
                        } else {
                          openPinnedPreview(row, e.currentTarget.closest("tr")!);
                        }
                      }}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <MonsterResultPreviewFloating
        preview={preview}
        previewId={previewId}
        onClose={closePreview}
      />
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
    </>
  );
}
