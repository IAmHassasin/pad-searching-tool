import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { useTruncatedTitle } from "../hooks/useTruncatedTitle";
import { monsterRowId } from "../lib/filters";
import { formatLeaderSkillEhp } from "../lib/leader-ehp";
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
      className={`truncate font-semibold text-[var(--color-fg-strong)] ${
        minimal ? "text-[11px]" : "text-[13px]"
      }`}
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
  const showEhpCol = !compact && !minimal && resultSort === "ls_ehp";
  const showInfoCol = !hoverCapable;

  const estimateSize = showInlineCard ? 152 : compact || minimal ? 40 : 44;

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

  const columns = [minimal ? "3.25rem" : "4rem", "minmax(0,1fr)"];
  if (showCdCol) columns.push("4rem");
  if (showEhpCol) columns.push("4rem");
  if (showInfoCol) columns.push("2rem");
  const gridTemplateColumns = columns.join(" ");

  const headerCell = `py-1.5 ${minimal ? "px-1" : "px-2"}`;
  const rowGutter = minimal ? "px-1.5" : "px-2.5";

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
      <div
        className={`ds-label sticky top-0 z-10 grid border-b border-white/[0.06] bg-[var(--color-surface)]/95 text-left ${rowGutter}`}
        style={{ gridTemplateColumns }}
      >
        <div className="whitespace-nowrap px-1.5 py-1.5">ID</div>
        <div className={headerCell}>Name</div>
        {showCdCol && <div className="px-2 py-1.5">CD</div>}
        {showEhpCol && <div className="px-2 py-1.5">eHP</div>}
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
                className={`absolute top-0 left-0 w-full pt-1.5 ${rowGutter}`}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={active ? true : undefined}
                  onClick={() => onSelect(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(row);
                    }
                  }}
                  className={`grid cursor-pointer items-center rounded-xl border transition-colors duration-150 ${
                    active
                      ? "border-[var(--color-accent)]/60 bg-[var(--color-hover)] shadow-[var(--shadow-glow)]"
                      : "border-white/[0.05] bg-[var(--color-panel)]/90 hover:border-white/10 hover:bg-[var(--color-hover)]"
                  }`}
                  style={{ gridTemplateColumns }}
                >
                  <div className={`self-start ${minimal ? "py-1.5 pl-1" : "py-2 pl-1.5"}`}>
                    <span
                      className={`inline-block whitespace-nowrap rounded-md bg-[var(--color-inset)] font-mono font-bold tabular-nums tracking-wide text-[var(--color-accent-strong)] ring-1 ring-[var(--color-accent)]/20 ${
                        minimal ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[11px]"
                      }`}
                    >
                      {row.monster_no_na != null ? `#${row.monster_no_na}` : "—"}
                    </span>
                  </div>
                  <div className={`min-w-0 ${minimal ? "px-1 py-1.5" : "px-2 py-2"}`}>
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
                    <div className="px-2 py-2 font-mono font-semibold text-[var(--color-secondary-strong)]">
                      {formatCd(row)}
                    </div>
                  )}
                  {showEhpCol && (
                    <div className="px-2 py-2 font-mono font-semibold text-[var(--color-secondary-strong)]">
                      {formatLeaderSkillEhp(row)}
                    </div>
                  )}
                  {showInfoCol && (
                    <div className="self-start py-1.5 pr-1">
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
