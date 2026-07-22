import { monsterRowId } from "../lib/filters";
import { MonsterPortrait } from "../components/MonsterPortrait";
import type { MonsterRecord } from "../types";

type ViewMode = "art" | "card";

type Props = {
  nodes: MonsterRecord[];
  activeIndex: number;
  onSelect: (index: number) => void;
  viewModeByMonster: Record<number, ViewMode>;
};

export function EventFamilyCarousel({
  nodes,
  activeIndex,
  onSelect,
  viewModeByMonster,
}: Props) {
  if (nodes.length <= 1) return null;

  const go = (delta: number) => {
    onSelect((activeIndex + delta + nodes.length) % nodes.length);
  };

  return (
    <div className="flex items-center gap-2 border-t border-[#6b4f2a]/70 bg-[#1a140e]/90 px-3 py-3">
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous form"
        className="shrink-0 rounded-full border border-[#6b4f2a]/90 bg-[#2f2118] px-2 py-1 text-[#e8dcc8] hover:border-[#c9a84a] hover:text-white"
      >
        ‹
      </button>
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
        {nodes.map((row, i) => {
          const id = monsterRowId(row);
          const selected = i === activeIndex;
          const mode = viewModeByMonster[id] ?? "art";
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={row.name_en ?? `Monster ${id}`}
              className={`relative shrink-0 rounded-lg border p-0.5 transition-shadow ${
                selected
                  ? "border-[#ffd54f] shadow-[0_0_10px_rgba(255,213,79,0.5)]"
                  : "border-[#8b6914]/70 hover:border-[#c9a84a]"
              }`}
              style={{ width: 56, height: 56 }}
            >
              <MonsterPortrait
                monsterId={id}
                alt=""
                variant="icon"
                className="h-full w-full rounded object-cover"
              />
              <span
                className="absolute -bottom-1 -right-1 rounded-full border border-[#6b4f2a] bg-[#0f0c0a] px-1 text-[8px] font-bold text-[#c9b08a]"
                title={mode === "art" ? "Artwork" : "Card"}
              >
                {mode === "art" ? "A" : "C"}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next form"
        className="shrink-0 rounded-full border border-[#6b4f2a]/90 bg-[#2f2118] px-2 py-1 text-[#e8dcc8] hover:border-[#c9a84a] hover:text-white"
      >
        ›
      </button>
    </div>
  );
}
