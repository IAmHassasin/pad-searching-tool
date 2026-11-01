import { MonsterAttributeSpriteIcon } from "../components/MonsterAttributeSpriteIcon";
import { monsterAttributeLabel } from "../lib/monster-attributes";
import type { OneTouchDungeon } from "./types";

type Props = {
  dungeons: OneTouchDungeon[];
  selectedId: string;
  onSelect: (id: string) => void;
};

/** Selected-tile styling per PAD attribute id (0 fire … 4 dark). */
const ACTIVE_ELEMENT_CLASS: Record<number, string> = {
  0: "border-[var(--color-pad-fire)] bg-[var(--color-pad-fire)]/15 text-[var(--color-pad-fire)] shadow-[0_0_14px_-2px_var(--color-pad-fire)]",
  1: "border-[var(--color-pad-water)] bg-[var(--color-pad-water)]/15 text-[var(--color-pad-water)] shadow-[0_0_14px_-2px_var(--color-pad-water)]",
  2: "border-[var(--color-pad-wood)] bg-[var(--color-pad-wood)]/15 text-[var(--color-pad-wood)] shadow-[0_0_14px_-2px_var(--color-pad-wood)]",
  3: "border-[var(--color-pad-light)] bg-[var(--color-pad-light)]/15 text-[var(--color-pad-light)] shadow-[0_0_14px_-2px_var(--color-pad-light)]",
  4: "border-[var(--color-pad-dark)] bg-[var(--color-pad-dark)]/15 text-[var(--color-pad-dark)] shadow-[0_0_14px_-2px_var(--color-pad-dark)]",
};

const ACTIVE_FALLBACK_CLASS =
  "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)] shadow-[var(--shadow-glow)]";

export function DungeonAttributePicker({
  dungeons,
  selectedId,
  onSelect,
}: Props) {
  return (
    <div
      className="grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3"
      role="tablist"
      aria-label="One-Touch dungeon areas"
    >
      {dungeons.map((d) => {
        const active = d.id === selectedId;
        return (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={`${d.nameEn} (${d.nameJa})`}
            onClick={() => onSelect(d.id)}
            className={`pressable flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 sm:min-w-[5.5rem] sm:px-3 ${
              active
                ? ACTIVE_ELEMENT_CLASS[d.attributeId] ?? ACTIVE_FALLBACK_CLASS
                : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-strong)]"
            }`}
          >
            <MonsterAttributeSpriteIcon
              attributeId={d.attributeId}
              size={32}
              title={monsterAttributeLabel(d.attributeId)}
            />
            <span className="w-full truncate text-center text-[11px] font-semibold sm:text-xs">
              {d.nameEn}
            </span>
          </button>
        );
      })}
    </div>
  );
}
