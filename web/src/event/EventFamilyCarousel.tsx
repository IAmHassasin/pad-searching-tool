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
    <div className="flex items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-panel)]/90 px-3 py-3">
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous form"
        className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-inset)] text-[var(--color-fg)] hover:border-[var(--color-accent)]/60 hover:text-[var(--color-fg-strong)]"
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
              className={`pressable relative shrink-0 rounded-lg border p-0.5 ${
                selected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] shadow-[var(--shadow-glow)]"
                  : "border-[var(--color-border-strong)] hover:border-[var(--color-accent)]/60"
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
                className="absolute -bottom-1 -right-1 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-inset)] px-1 font-mono text-[8px] font-bold text-[var(--color-muted)]"
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
        className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-inset)] text-[var(--color-fg)] hover:border-[var(--color-accent)]/60 hover:text-[var(--color-fg-strong)]"
      >
        ›
      </button>
    </div>
  );
}
