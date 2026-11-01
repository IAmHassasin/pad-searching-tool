import { useEffect, useState } from "react";
import { MonsterDetailCard } from "../components/MonsterDetailCard";
import { MonsterPortrait } from "../components/MonsterPortrait";
import { monsterRowId } from "../lib/filters";
import { EventFamilyCarousel } from "./EventFamilyCarousel";
import type { MonsterFamily } from "./types";

type ViewMode = "art" | "card";

type Props = {
  family: MonsterFamily;
  initialMonsterId: number;
  onClose: () => void;
};

export function EventMonsterModal({ family, initialMonsterId, onClose }: Props) {
  const nodes = family.nodes;
  const [activeIndex, setActiveIndex] = useState(() => {
    const idx = nodes.findIndex((row) => monsterRowId(row) === initialMonsterId);
    return idx >= 0 ? idx : 0;
  });
  const [viewModeByMonster, setViewModeByMonster] = useState<
    Record<number, ViewMode>
  >({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") {
        setActiveIndex((i) => (i - 1 + nodes.length) % nodes.length);
      }
      if (e.key === "ArrowRight") {
        setActiveIndex((i) => (i + 1) % nodes.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nodes.length, onClose]);

  const activeRow = nodes[activeIndex];
  if (!activeRow) return null;

  const activeId = monsterRowId(activeRow);
  const mode = viewModeByMonster[activeId] ?? "art";
  const setMode = (next: ViewMode) => {
    setViewModeByMonster((prev) => ({ ...prev, [activeId]: next }));
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="ds-float animate-sheet-in relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:animate-fade-in sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="pressable absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-panel)]/90 text-base text-[var(--color-fg)] hover:border-[var(--color-accent)]/60 hover:text-[var(--color-fg-strong)]"
        >
          ×
        </button>

        <div className="absolute right-3 top-3 z-20 flex shrink-0 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-inset)]/90 p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setMode("art")}
            aria-pressed={mode === "art"}
            className={`pressable rounded-full px-3 py-1.5 ${
              mode === "art"
                ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-fg-strong)]"
            }`}
          >
            Artwork
          </button>
          <button
            type="button"
            onClick={() => setMode("card")}
            aria-pressed={mode === "card"}
            className={`pressable rounded-full px-3 py-1.5 ${
              mode === "card"
                ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-fg-strong)]"
            }`}
          >
            Card
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-14">
          {mode === "art" ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center">
              <MonsterPortrait
                monsterId={activeId}
                alt={activeRow.name_en ?? ""}
                className="max-h-[56vh] w-auto max-w-full object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.6)]"
              />
            </div>
          ) : (
            <MonsterDetailCard row={activeRow} />
          )}
        </div>

        <EventFamilyCarousel
          nodes={nodes}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          viewModeByMonster={viewModeByMonster}
        />
      </div>
    </div>
  );
}
