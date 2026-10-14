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
      className="ds-card pressable group flex flex-col overflow-hidden text-left hover:border-white/10 hover:bg-[var(--color-hover)] focus-visible:outline-offset-2"
    >
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_30%,var(--color-hover)_0%,var(--color-inset)_80%)]">
        {label && (
          <span className="absolute left-1.5 top-1.5 z-10 rounded bg-[var(--color-negative)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
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
      <div className="flex min-w-0 flex-col items-center gap-1 border-t border-white/[0.06] px-2 py-2">
        <h3 className="w-full truncate text-center text-sm font-semibold text-[var(--color-fg-strong)] sm:text-base">
          {row.name_en ?? "Unknown"}
        </h3>
        {row.monster_no_na != null && (
          <span className="rounded-md bg-[var(--color-inset)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--color-accent-strong)] ring-1 ring-[var(--color-accent)]/20">
            #{row.monster_no_na}
          </span>
        )}
      </div>
    </button>
  );
}
