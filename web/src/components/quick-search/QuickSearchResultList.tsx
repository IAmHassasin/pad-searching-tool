import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import {
  monsterNameNeedsTranslation,
  useMonsterNameTranslation,
} from "../../hooks/useLiveMonsterNames";
import { useTruncatedTitle } from "../../hooks/useTruncatedTitle";
import { monsterRowId } from "../../lib/filters";
import { listedMonsterId } from "../../lib/result-id-scope";
import type { MonsterRecord } from "../../types";
import { MonsterPortrait } from "../MonsterPortrait";
import {
  MonsterPreviewInfoButton,
  MonsterResultPreviewFloating,
  useMonsterResultPreview,
} from "../MonsterResultPreviewPopover";

type Props = {
  rows: MonsterRecord[];
  loading: boolean;
  /** True when a field is waiting for a pick (rows become fill buttons). */
  canPick: boolean;
  onPick: (row: MonsterRecord) => void;
};

function RowName({ name }: { name: string }) {
  const title = useTruncatedTitle<HTMLParagraphElement>(name);
  return (
    <p
      ref={title.ref}
      title={title.title}
      className="truncate text-[11px] font-semibold text-[var(--color-fg-strong)]"
    >
      {name}
    </p>
  );
}

/** Mobile-style compact rows (icon · id · name) with pick + preview actions. */
export function QuickSearchResultList({ rows, loading, canPick, onPick }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { requestIds, nameFor } = useMonsterNameTranslation();
  const { preview, previewId, openPinnedPreview, closePreview } =
    useMonsterResultPreview();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8,
    getItemKey: (index) => monsterRowId(rows[index]!),
  });

  const virtualItems = virtualizer.getVirtualItems();
  const visibleKey = virtualItems.map((item) => item.index).join(",");
  useEffect(() => {
    const ids: number[] = [];
    for (const item of virtualItems) {
      const row = rows[item.index];
      if (row && monsterNameNeedsTranslation(row)) ids.push(monsterRowId(row));
    }
    requestIds(ids);
  }, [visibleKey, rows, requestIds, virtualItems]);

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-auto px-1.5 pb-2">
      {rows.length > 0 && (
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index]!;
            const id = monsterRowId(row);
            const listedId = listedMonsterId(row);
            const previewOpen =
              preview != null && monsterRowId(preview.row) === id;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full pt-1.5"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.05] bg-[var(--color-panel)]/90 px-1.5 py-1 hover:border-white/10 hover:bg-[var(--color-hover)]">
                  <button
                    type="button"
                    onClick={() => onPick(row)}
                    title={canPick ? `Fill #${id}` : "Click an ID field first"}
                    className="pressable flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    <MonsterPortrait
                      monsterId={id}
                      alt=""
                      variant="icon"
                      className="h-9 w-9 shrink-0 rounded-md border border-white/10 object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <RowName name={nameFor(row)} />
                      <span
                        className={`mt-0.5 inline-block font-mono text-[10px] font-bold tabular-nums ${
                          listedId.region === "jp"
                            ? "text-[var(--color-secondary-strong)]"
                            : "text-[var(--color-accent-strong)]"
                        }`}
                      >
                        {listedId.text}
                      </span>
                    </span>
                    {canPick && (
                      <span
                        aria-hidden
                        className="shrink-0 rounded-md bg-[var(--color-accent-muted)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-[var(--color-accent-strong)]"
                      >
                        Fill
                      </span>
                    )}
                  </button>
                  <MonsterPreviewInfoButton
                    describedBy={previewOpen ? previewId : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (previewOpen) {
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
        <p className="p-3 text-xs text-[var(--color-muted)]">
          No monsters match the current filters.
        </p>
      )}
    </div>
  );
}
