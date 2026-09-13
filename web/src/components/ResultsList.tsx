import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { useTruncatedTitle } from "../hooks/useTruncatedTitle";
import { monsterRowId } from "../lib/filters";
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

function MonsterNameCell({
  name,
  minimal,
}: {
  name: string;
  minimal?: boolean;
}) {
  const nameTitle = useTruncatedTitle<HTMLParagraphElement>(name);
  return (
    <p
      ref={nameTitle.ref}
      title={nameTitle.title}
      className={`truncate ${minimal ? "text-[10px]" : ""}`}
    >
      {name}
    </p>
  );
}

type Props = {
  rows: MonsterRecord[];
  selected: MonsterRecord | null;
  onSelect: (row: MonsterRecord | null) => void;
  loading: boolean;
  compact?: boolean;
  /** Mobile split view: only NA ID and name */
  minimal?: boolean;
  resultSort?: ResultSortOption;
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
  displaySections,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const {
    preview,
    previewId,
    openPinnedPreview,
    closePreview,
    hoverCapable,
  } = useMonsterResultPreview();

  const showCd =
    resultSort === "cd_fastest" || resultSort === "cd_longest";
  const showInlineCard =
    displaySections != null && hasAnyDisplaySection(displaySections);
  const showCdCol = !compact && !minimal && showCd;
  const showInfoCol = !hoverCapable;

  const estimateSize = showInlineCard ? 140 : compact || minimal ? 28 : 32;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 8,
    getItemKey: (index) => monsterRowId(rows[index]!),
  });

  const formatCd = (row: MonsterRecord) => {
    const min = row.active_skill_cooldown_min;
    const max = row.active_skill_cooldown_max;
    if (min == null && max == null) return "—";
    if (min != null && max != null && min !== max) return `${min}–${max}`;
    return String(min ?? max);
  };

  const columns = ["3.5rem", "minmax(0,1fr)"];
  if (showCdCol) columns.push("4rem");
  if (showInfoCol) columns.push(minimal ? "1.5rem" : "1.75rem");
  const gridTemplateColumns = columns.join(" ");

  const headerCell = `py-1.5 text-[var(--color-muted)] ${minimal ? "px-1" : "px-2"}`;

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
      <div
        className="sticky top-0 z-10 grid border-b border-[var(--color-border)] bg-[#21262d] text-left text-xs"
        style={{ gridTemplateColumns }}
      >
        <div className="w-14 whitespace-nowrap px-1 py-1.5">ID</div>
        <div className={headerCell}>Name</div>
        {showCdCol && <div className="px-2 py-1.5">CD</div>}
        {showInfoCol && <div />}
      </div>

      {rows.length > 0 && (
        <div
          className="relative w-full text-xs"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]!;
            const id = monsterRowId(row);
            const active = selected && monsterRowId(selected) === id;

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(row)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(row);
                  }
                }}
                className={`absolute top-0 left-0 grid w-full cursor-pointer border-t border-[var(--color-border)] hover:bg-[#21262d] ${
                  active ? "bg-[#1f3a5f]" : ""
                }`}
                style={{
                  gridTemplateColumns,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className={`w-14 whitespace-nowrap py-1 font-mono tabular-nums ${
                    minimal ? "px-1 text-[10px]" : "px-1 text-xs"
                  }`}
                >
                  {row.monster_no_na ?? "—"}
                </div>
                <div className={`min-w-0 py-1 ${minimal ? "px-1" : "px-2"}`}>
                  <div className="min-w-0">
                    {!(
                      showInlineCard &&
                      displaySections &&
                      isAllSectionsEnabled(displaySections)
                    ) && (
                      <MonsterNameCell
                        name={row.name_en ?? "—"}
                        minimal={minimal}
                      />
                    )}
                    {showInlineCard && displaySections && (
                      <MonsterQuickPreview
                        row={row}
                        variant="inline"
                        sections={displaySections}
                      />
                    )}
                  </div>
                </div>
                {showCdCol && (
                  <div className="px-2 py-1 font-mono">{formatCd(row)}</div>
                )}
                {showInfoCol && (
                  <div className={`py-1 ${minimal ? "px-0" : "px-0.5"}`}>
                    <MonsterPreviewInfoButton
                      describedBy={
                        preview != null &&
                        monsterRowId(preview.row) === id
                          ? previewId
                          : undefined
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          preview != null &&
                          monsterRowId(preview.row) === id
                        ) {
                          closePreview();
                        } else {
                          openPinnedPreview(
                            row,
                            e.currentTarget.closest("[data-index]") as HTMLElement
                          );
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <MonsterResultPreviewFloating
        preview={preview}
        previewId={previewId}
        onClose={closePreview}
      />
      {!loading && rows.length === 0 && (
        <p className="p-4 text-sm text-[var(--color-muted)]">
          No monsters match the current filters.
        </p>
      )}
    </div>
  );
}
