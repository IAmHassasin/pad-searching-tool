import type { MouseEvent } from "react";
import { monsterRowId } from "../lib/filters";
import type { MonsterRecord } from "../types";
import { MonsterPortrait } from "./MonsterPortrait";

type Props = {
  row: MonsterRecord;
  selected?: boolean;
  onSelect: (row: MonsterRecord) => void;
  size?: number;
};

export function MonsterRelationIcon({
  row,
  selected = false,
  onSelect,
  size = 48,
}: Props) {
  const monsterId = monsterRowId(row);

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onSelect(row);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={row.name_en ?? `Monster ${monsterId}`}
      className={`pressable shrink-0 rounded-md border bg-[var(--color-inset)] p-0.5 ${
        selected
          ? "border-[var(--color-accent)] shadow-[var(--shadow-glow)] ring-2 ring-[var(--color-accent)]/40"
          : "border-white/10 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)]"
      }`}
      style={{ width: size, height: size }}
    >
      <MonsterPortrait
        monsterId={monsterId}
        alt=""
        variant="icon"
        className="h-full w-full rounded object-cover"
      />
    </button>
  );
}
