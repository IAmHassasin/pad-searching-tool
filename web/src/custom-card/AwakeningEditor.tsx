import { useRef, useState } from "react";
import { AWAKENING_FILTER_GROUPS } from "../lib/awakening-filter-groups";
import { AwakeningSpriteIcon } from "../components/AwakeningSpriteIcon";
import {
  countAwakeningInStack,
  pushAwakeningStack,
} from "../components/filters/awakening-filter-shared";
import type { CustomCardDraft } from "./types";

type Props = {
  draft: CustomCardDraft;
  onChange: (patch: Partial<CustomCardDraft>) => void;
};

type Layer = "regular" | "super" | "sync";

function reorderIds(ids: number[], from: number, to: number): number[] {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) {
    return ids;
  }
  const next = [...ids];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function DraggableAwakeningStack({
  ids,
  accent,
  badge,
  onReorder,
  onRemoveAt,
}: {
  ids: number[];
  accent: "regular" | "super";
  badge?: string;
  onReorder: (next: number[]) => void;
  onRemoveAt: (index: number) => void;
}) {
  const dragFrom = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const didDrag = useRef(false);

  if (!ids.length) return null;

  const border =
    accent === "super"
      ? "border-[var(--color-gold)]/60 bg-[var(--color-amber-bg)]"
      : "border-[var(--color-positive)]/50 bg-emerald-500/10";
  const overRing =
    accent === "super"
      ? "ring-1 ring-[var(--color-gold)]"
      : "ring-1 ring-[var(--color-positive)]";

  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id, index) => (
        <button
          key={`${accent}-${index}-${id}`}
          type="button"
          draggable
          title={`#${index + 1} awk ${id} — drag to reorder, click to remove`}
          onDragStart={(e) => {
            didDrag.current = false;
            dragFrom.current = index;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(index));
          }}
          onDragEnd={() => {
            dragFrom.current = null;
            setOverIndex(null);
            // Keep didDrag true briefly so click after drop doesn't remove.
            window.setTimeout(() => {
              didDrag.current = false;
            }, 0);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            didDrag.current = true;
            if (overIndex !== index) setOverIndex(index);
          }}
          onDragLeave={() => {
            if (overIndex === index) setOverIndex(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const from = dragFrom.current;
            setOverIndex(null);
            dragFrom.current = null;
            didDrag.current = true;
            if (from == null) return;
            onReorder(reorderIds(ids, from, index));
          }}
          onClick={() => {
            if (didDrag.current) return;
            onRemoveAt(index);
          }}
          className={`inline-flex cursor-grab items-center gap-0.5 rounded-md border p-0.5 active:cursor-grabbing ${border} ${
            overIndex === index ? overRing : ""
          }`}
        >
          {badge && (
            <span className="pl-0.5 font-mono text-[8px] font-bold text-[var(--color-gold)]">
              {badge}
            </span>
          )}
          <AwakeningSpriteIcon awokenSkillId={id} size={18} />
          <span className="pr-0.5 font-mono text-[8px] text-[var(--color-muted)] tabular-nums">
            {index + 1}
          </span>
        </button>
      ))}
    </div>
  );
}

export function AwakeningEditor({ draft, onChange }: Props) {
  const [layer, setLayer] = useState<Layer>("regular");

  const setPrefixedMode = (mode: "super" | "sync") => {
    if (mode === "super") {
      onChange({ prefixedMode: "super", syncAwakeningId: null });
    } else {
      onChange({
        prefixedMode: "sync",
        superAwakeningIds: [],
      });
    }
  };

  const append = (id: number) => {
    if (layer === "regular") {
      onChange({
        awakeningIds: pushAwakeningStack(draft.awakeningIds, id),
      });
      return;
    }
    if (layer === "super") {
      onChange({
        prefixedMode: "super",
        syncAwakeningId: null,
        superAwakeningIds: pushAwakeningStack(draft.superAwakeningIds, id),
      });
      return;
    }
    onChange({
      prefixedMode: "sync",
      superAwakeningIds: [],
      syncAwakeningId: id,
    });
  };

  const removeAt = (key: "awakeningIds" | "superAwakeningIds", index: number) => {
    const list = [...draft[key]];
    list.splice(index, 1);
    onChange({ [key]: list });
  };

  const hasAny =
    draft.awakeningIds.length > 0 ||
    draft.superAwakeningIds.length > 0 ||
    draft.syncAwakeningId != null;

  return (
    <section className="ds-card p-3">
      <h2 className="ds-label mb-2">Awakenings</h2>

      <div className="mb-2 flex gap-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-inset)] p-0.5">
        {(
          [
            { id: "regular" as const, label: "Regular" },
            { id: "super" as const, label: "Super" },
            { id: "sync" as const, label: "Sync" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setLayer(id);
              if (id === "super") setPrefixedMode("super");
              if (id === "sync") setPrefixedMode("sync");
            }}
            className={`pressable min-h-8 flex-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${
              layer === id
                ? "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)] shadow-[var(--shadow-glow)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg-strong)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {hasAny && (
        <div className="mb-2 space-y-1.5">
          {draft.awakeningIds.length > 0 && (
            <div>
              <p className="mb-0.5 text-[9px] font-semibold tracking-wide text-emerald-300 uppercase">
                Regular order — drag to reorder, click to remove
              </p>
              <DraggableAwakeningStack
                ids={draft.awakeningIds}
                accent="regular"
                onReorder={(awakeningIds) => onChange({ awakeningIds })}
                onRemoveAt={(i) => removeAt("awakeningIds", i)}
              />
            </div>
          )}
          {draft.prefixedMode === "super" && draft.superAwakeningIds.length > 0 && (
            <div>
              <p className="mb-0.5 text-[9px] font-semibold tracking-wide text-[var(--color-gold)] uppercase">
                Super order — drag to reorder, click to remove
              </p>
              <DraggableAwakeningStack
                ids={draft.superAwakeningIds}
                accent="super"
                badge="S"
                onReorder={(superAwakeningIds) =>
                  onChange({ superAwakeningIds, prefixedMode: "super" })
                }
                onRemoveAt={(i) => removeAt("superAwakeningIds", i)}
              />
            </div>
          )}
          {draft.prefixedMode === "sync" && draft.syncAwakeningId != null && (
            <div>
              <p className="mb-0.5 text-[9px] font-semibold tracking-wide text-[var(--color-secondary-strong)] uppercase">
                Sync
              </p>
              <button
                type="button"
                title="Clear sync"
                onClick={() => onChange({ syncAwakeningId: null })}
                className="pressable inline-flex items-center gap-0.5 rounded-md border border-[var(--color-secondary)]/60 bg-[var(--color-secondary-muted)] p-0.5 pr-1.5"
              >
                <span className="pl-0.5 font-mono text-[8px] font-bold text-[var(--color-secondary-strong)]">
                  Y
                </span>
                <AwakeningSpriteIcon
                  awokenSkillId={draft.syncAwakeningId}
                  size={18}
                />
              </button>
            </div>
          )}
        </div>
      )}

      {layer === "sync" && (
        <p className="mb-1.5 text-[9px] text-[var(--color-muted)]">
          Sync allows one awakening (clears Super).
        </p>
      )}

      {/* Full desktop-style picker: all groups in multi-column layout */}
      <div className="max-h-[min(52vh,28rem)] overflow-y-auto columns-[168px] gap-x-3 pr-0.5 [column-fill:auto]">
        {AWAKENING_FILTER_GROUPS.map((group) => (
          <section
            key={group.label}
            className="mb-2 break-inside-avoid last:mb-0"
          >
            <p className="ds-label mb-1">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.rows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex flex-wrap gap-0.5">
                  {row.map((id) => {
                    const count =
                      layer === "regular"
                        ? countAwakeningInStack(draft.awakeningIds, id)
                        : layer === "super"
                          ? countAwakeningInStack(draft.superAwakeningIds, id)
                          : draft.syncAwakeningId === id
                            ? 1
                            : 0;
                    return (
                      <button
                        key={`${group.label}-${rowIndex}-${id}`}
                        type="button"
                        title={`Add awakening #${id}`}
                        onClick={() => append(id)}
                        className={`pressable rounded border p-0.5 ${
                          count > 0
                            ? "border-[var(--color-accent)]/80 bg-[var(--color-accent-muted)]"
                            : "border-transparent hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)]"
                        }`}
                      >
                        <AwakeningSpriteIcon awokenSkillId={id} size={18} />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
