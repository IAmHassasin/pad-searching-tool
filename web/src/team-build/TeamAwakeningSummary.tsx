import { AwakeningSpriteIcon } from "../components/AwakeningSpriteIcon";
import {
  countTeamAwakenings,
  type TeamAwakeningCount,
  type TeamAwakeningSlotInput,
} from "../lib/team-build/team-awakenings";

type Props = {
  slots: TeamAwakeningSlotInput[];
  /** Compact inline rendering (mobile, below the team row). */
  inline?: boolean;
};

const ICON = 24;

/** Green = on the cards, red = granted by assists, both = mixed sources. */
function tileRing(row: TeamAwakeningCount): string {
  if (row.fromCards > 0 && row.fromAssists > 0) {
    return "border-emerald-500/80 bg-emerald-500/10 ring-1 ring-inset ring-red-500/80";
  }
  if (row.fromAssists > 0) return "border-red-500/80 bg-red-500/10";
  return "border-emerald-500/80 bg-emerald-500/10";
}

function CountTile({ row }: { row: TeamAwakeningCount }) {
  const parts = [
    row.fromCards > 0 ? `${row.fromCards} from cards` : null,
    row.fromAssists > 0 ? `${row.fromAssists} from assists` : null,
  ].filter(Boolean);
  const title = `#${row.id} ×${row.total} (${parts.join(", ")})`;
  return (
    <span
      className={`relative flex items-center justify-center rounded-md border p-0.5 ${tileRing(row)}`}
      title={title}
    >
      <AwakeningSpriteIcon awokenSkillId={row.id} size={ICON} title={title} />
      {row.total > 1 && (
        <span className="absolute -right-1 -top-1 rounded bg-[var(--color-accent)] px-1 font-mono text-[9px] font-bold leading-none text-slate-950">
          ×{row.total}
        </span>
      )}
    </span>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-sm border ${className}`} />
      {label}
    </span>
  );
}

/**
 * Right-hand panel content when no slot is selected: every awakening the
 * team brings (cards, sync, chosen super awakenings and Awoken Assist grants)
 * with how many copies of each, colour-coded by source.
 */
export function TeamAwakeningSummary({ slots, inline = false }: Props) {
  const rows = countTeamAwakenings(slots);
  const cardCount = slots.filter((s) => s.monster).length;
  const total = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className={`flex min-h-0 flex-col gap-2 ${inline ? "" : "h-full overflow-y-auto p-3"}`}>
      <div className="flex items-center gap-2 px-0.5">
        <span className="ds-label shrink-0 text-[var(--color-accent-strong)]">Team</span>
        <span className="min-w-0 truncate text-xs font-semibold text-[var(--color-fg-strong)]">
          {cardCount} card{cardCount === 1 ? "" : "s"}
        </span>
        <span className="ml-auto shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-inset)] px-1.5 py-px font-mono text-[9px] font-bold text-[var(--color-fg)]">
          {total} awakenings
        </span>
      </div>

      <section className="ds-card p-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h3 className="ds-label">Team awakenings</h3>
          <span className="text-[9px] text-[var(--color-faint)]">cards + sync + super + assist grants</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-[10px] text-[var(--color-muted)]">Add cards to the team to see its awakenings.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {rows.map((r) => (
              <CountTile key={r.id} row={r} />
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[var(--color-faint)]">
          <LegendSwatch className="border-emerald-500/80 bg-emerald-500/10" label="from cards" />
          <LegendSwatch className="border-red-500/80 bg-red-500/10" label="from assists (Awoken Assist)" />
          <LegendSwatch
            className="border-emerald-500/80 bg-emerald-500/10 ring-1 ring-inset ring-red-500/80"
            label="both"
          />
        </div>
      </section>

      <p className="px-0.5 text-[10px] text-[var(--color-muted)]">
        Click a slot to see that card's awakenings and stat bonuses; click it again to come back
        to the team view.
      </p>
    </div>
  );
}
