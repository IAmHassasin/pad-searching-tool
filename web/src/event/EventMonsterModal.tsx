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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-[#a8842f] bg-[#0f0c0a] shadow-[0_16px_48px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-[#6b4f2a]/90 bg-[#2f2118]/90 text-base text-[#e8dcc8] hover:border-[#c9a84a] hover:text-white"
        >
          ×
        </button>

        <div className="absolute right-3 top-3 z-20 flex shrink-0 rounded-full border border-[#6b4f2a]/90 bg-[#2f2118]/90 p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setMode("art")}
            className={`rounded-full px-2.5 py-1 transition-colors ${
              mode === "art"
                ? "bg-[#5c4a12] text-[#ffe082]"
                : "text-[#c9b08a] hover:text-white"
            }`}
          >
            Artwork
          </button>
          <button
            type="button"
            onClick={() => setMode("card")}
            className={`rounded-full px-2.5 py-1 transition-colors ${
              mode === "card"
                ? "bg-[#5c4a12] text-[#ffe082]"
                : "text-[#c9b08a] hover:text-white"
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
