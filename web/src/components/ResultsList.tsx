import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import {
  monsterNameNeedsTranslation,
  useMonsterNameTranslation,
} from "../hooks/useLiveMonsterNames";
import { useTruncatedTitle } from "../hooks/useTruncatedTitle";
import { monsterRowId } from "../lib/filters";
import { listedMonsterId } from "../lib/result-id-scope";
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

function groupMatchMark(row: MonsterRecord): {
  name: string;
  kind: "collab" | "group";
} | null {
  const name = row.matched_group_name?.trim() ?? "";
  if (!name) return null;
  return {
    name,
    kind: row.matched_group_kind === "collab" ? "collab" : "group",
  };
}

function GroupMatchMark({
  name,
  kind,
  minimal,
}: {
  name: string;
  kind: "collab" | "group";
  minimal?: boolean;
}) {
  const kindLabel = kind === "collab" ? "Collab" : "Group";
  return (
    <p
      className={`mt-0.5 flex min-w-0 items-center gap-1 ${
        minimal ? "text-[9px]" : "text-[10px]"
      }`}
      title={`${kindLabel}: ${name}`}
    >
      <span className="shrink-0 rounded bg-[var(--color-accent-muted)] px-1 py-px font-mono font-semibold uppercase tracking-wide text-[var(--color-accent-strong)]">
        {kindLabel}
      </span>
      <span className="truncate text-[var(--color-muted)]">{name}</span>
    </p>
  );
}

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
  const { requestIds, nameFor } = useMonsterNameTranslation();
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

  const virtualItems = virtualizer.getVirtualItems();
  const visibleIndexKey = virtualItems.map((item) => item.index).join(",");
  useEffect(() => {
    const ids: number[] = [];
    for (const item of virtualItems) {
      const row = rows[item.index];
      if (row && monsterNameNeedsTranslation(row)) ids.push(monsterRowId(row));
    }
    if (selected && monsterNameNeedsTranslation(selected)) {
      ids.push(monsterRowId(selected));
    }
    requestIds(ids);
  }, [visibleIndexKey, rows, selected, requestIds, virtualItems]);

  const formatCd = (row: MonsterRecord) => {
    const min = row.active_skill_cooldown_min;
    const max = row.active_skill_cooldown_max;
    if (min == null && max == null) return "—";
    if (min != null && max != null && min !== max) return `${min}–${max}`;
    return String(min ?? max);
  };

  const columns = [minimal ? "4.75rem" : "5.5rem", "minmax(0,1fr)"];
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
          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index]!;
            const id = monsterRowId(row);
            const listedId = listedMonsterId(row);
            const active = selected && monsterRowId(selected) === id;
            const groupMark = groupMatchMark(row);

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
                      className={`inline-block whitespace-nowrap rounded-md bg-[var(--color-inset)] font-mono font-bold tabular-nums tracking-wide ring-1 ${
                        listedId.region === "jp"
                          ? "text-[var(--color-secondary-strong)] ring-[var(--color-secondary)]/30"
                          : "text-[var(--color-accent-strong)] ring-[var(--color-accent)]/20"
                      } ${
                        minimal ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[11px]"
                      }`}
                    >
                      {listedId.text}
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
                          name={nameFor(row)}
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
                      {groupMark && (
                        <GroupMatchMark
                          name={groupMark.name}
                          kind={groupMark.kind}
                          minimal={minimal}
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
