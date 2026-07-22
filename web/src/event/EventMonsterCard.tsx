import { monsterRowId } from "../lib/filters";
import { MonsterPortrait } from "../components/MonsterPortrait";
import type { MonsterRecord } from "../types";

type Props = {
  row: MonsterRecord;
  /** Portrait to display — defaults to `row`'s own id (e.g. the final transform form's art). */
  portraitMonsterId?: number;
  label?: string | null;
  onClick: () => void;
};

export function EventMonsterCard({
  row,
  portraitMonsterId,
  label,
  onClick,
}: Props) {
  const id = portraitMonsterId ?? monsterRowId(row);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-lg bg-transparent text-left transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd54f]"
    >
      <div className="relative overflow-hidden rounded-md bg-[radial-gradient(circle_at_50%_30%,#2a2118_0%,#0d0a06_80%)]">
        {label && (
          <span className="absolute left-1.5 top-1.5 z-10 rounded bg-[#c0392b] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
            {label}
          </span>
        )}
        <MonsterPortrait
          monsterId={id}
          alt={row.name_en ?? ""}
          variant="portrait"
          className="h-auto w-full object-contain object-top drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)] transition-transform group-hover:scale-[1.03]"
        />
      </div>
      <h3 className="mt-2 truncate text-center text-sm font-bold text-[#f0e6d2] sm:text-base">
        {row.name_en ?? "Unknown"}
      </h3>
    </button>
  );
}
