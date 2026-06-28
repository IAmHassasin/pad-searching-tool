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
      className={`shrink-0 rounded border bg-[#1a1410] p-0.5 transition-shadow ${
        selected
          ? "border-[#ffd54f] shadow-[0_0_8px_rgba(255,213,79,0.45)]"
          : "border-[#8b6914]/70 hover:border-[#c9a84a] hover:shadow-md"
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
