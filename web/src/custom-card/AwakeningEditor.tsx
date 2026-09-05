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
      ? "border-[#c9a84a]/60 bg-[#3a2f12]"
      : "border-[#6b8f3c]/60 bg-[#1a2a12]";
  const overRing =
    accent === "super" ? "ring-1 ring-[#c9a84a]" : "ring-1 ring-[#6b8f3c]";

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
            <span className="pl-0.5 text-[8px] font-bold text-[#c9a84a]">
              {badge}
            </span>
          )}
          <AwakeningSpriteIcon awokenSkillId={id} size={18} />
          <span className="pr-0.5 text-[8px] tabular-nums text-[var(--color-muted)]">
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
    <section className="rounded-lg border border-[var(--color-border)] bg-[#0d1117] p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#c9a84a]">
        Awakenings
      </h2>

      <div className="mb-2 flex rounded-lg border border-[var(--color-border)] bg-[#0d1117] p-0.5">
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
            className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium ${
              layer === id
                ? "bg-[#8b6914] text-white"
                : "text-[var(--color-muted)] hover:text-white"
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
              <p className="mb-0.5 text-[9px] font-semibold uppercase text-[#a8c878]">
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
              <p className="mb-0.5 text-[9px] font-semibold uppercase text-[#c9a84a]">
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
              <p className="mb-0.5 text-[9px] font-semibold uppercase text-[#58a6ff]">
                Sync
              </p>
              <button
                type="button"
                title="Clear sync"
                onClick={() => onChange({ syncAwakeningId: null })}
                className="inline-flex items-center gap-0.5 rounded-md border border-[#58a6ff]/60 bg-[#1a2a3f] p-0.5 pr-1.5"
              >
                <span className="pl-0.5 text-[8px] font-bold text-[#58a6ff]">
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
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#a8c878]">
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
                        className={`rounded border p-0.5 ${
                          count > 0
                            ? "border-[#c9a84a]/80 bg-[#3a2f12]"
                            : "border-transparent hover:border-[var(--color-border)]"
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
