import { MonsterAttributeSpriteIcon } from "../components/MonsterAttributeSpriteIcon";
import { monsterAttributeLabel } from "../lib/monster-attributes";
import type { OneTouchDungeon } from "./types";

type Props = {
  dungeons: OneTouchDungeon[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function DungeonAttributePicker({
  dungeons,
  selectedId,
  onSelect,
}: Props) {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-3"
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
            className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-colors ${
              active
                ? "border-[var(--color-accent)] bg-[#1c2d41] shadow-[0_0_0_1px_rgba(88,166,255,0.35)]"
                : "border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[#6b8f3c]/60"
            }`}
          >
            <MonsterAttributeSpriteIcon
              attributeId={d.attributeId}
              size={36}
              title={monsterAttributeLabel(d.attributeId)}
            />
            <span className="text-xs font-medium">{d.nameEn}</span>
          </button>
        );
      })}
    </div>
  );
}
