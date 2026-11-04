import { useState } from "react";
import { draftHasCards } from "../../lib/team-build/team-draft-storage";
import type { TeamBuildConfig } from "../../lib/team-build/types";
import { MonsterPortrait } from "../MonsterPortrait";
import { TEAM_SLOT_INDEXES, teamSlotLabel } from "./team-slot-labels";

type Props = {
  draft: TeamBuildConfig;
  onClear: () => void;
  /** Denser layout for the mobile results view. */
  compact?: boolean;
};

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function DockSlot({
  index,
  monsterId,
  eqId,
  size,
}: {
  index: number;
  monsterId: number | null;
  eqId: number | null;
  size: number;
}) {
  const label = teamSlotLabel(index);
  const leaderish = index === 0 || index === TEAM_SLOT_INDEXES.length - 1;
  return (
    <div
      className="flex shrink-0 flex-col items-center gap-0.5"
      title={`${label}${monsterId ? ` #${monsterId}` : ""}${eqId ? ` (eq #${eqId})` : ""}`}
    >
      <div
        className={`relative overflow-hidden rounded-lg border bg-[var(--color-inset)] ${
          leaderish
            ? "border-[var(--color-accent)]/40"
            : "border-white/10"
        }`}
        style={{ width: size, height: size }}
      >
        {monsterId ? (
          <MonsterPortrait
            monsterId={monsterId}
            variant="icon"
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--color-faint)]">
            —
          </div>
        )}
        {eqId && (
          <div
            className="absolute right-0 bottom-0 overflow-hidden rounded-tl border border-emerald-500/60 bg-[var(--color-inset)]"
            style={{ width: Math.round(size * 0.42), height: Math.round(size * 0.42) }}
          >
            <MonsterPortrait
              monsterId={eqId}
              variant="icon"
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>
      <span className="ds-label text-[8px]">{label}</span>
    </div>
  );
}

/**
 * Mini team preview shown on the search page once a card was sent to a slot.
 * The draft itself lives in localStorage (see useTeamDraft), so opening the
 * Team Build page shows the same cards.
 */
export function TeamDraftDock({ draft, onClear, compact = false }: Props) {
  const [open, setOpen] = useState(true);
  if (!draftHasCards(draft)) return null;

  const size = compact ? 36 : 44;
  const filled = draft.members.filter((m) => parseId(m.monsterId)).length;

  return (
    <section
      aria-label="Team draft"
      className={`shrink-0 border-t border-[var(--color-border)] bg-[var(--color-panel)]/95 ${
        compact ? "px-2 py-1.5" : "px-3 py-2"
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="pressable flex min-w-0 items-center gap-1.5 rounded-md text-left"
        >
          <span
            aria-hidden
            className={`text-[10px] text-[var(--color-accent)] transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          >
            ▾
          </span>
          <span className="ds-label text-[var(--color-fg)]">Team draft</span>
          <span className="font-mono text-[10px] tabular-nums text-[var(--color-muted)]">
            {filled}/{TEAM_SLOT_INDEXES.length}
          </span>
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClear}
          className="pressable rounded-lg px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted)] hover:bg-[var(--color-negative)]/10 hover:text-[var(--color-negative)]"
        >
          Clear
        </button>
        <a
          href="/team-build"
          className="ds-btn-primary pressable inline-flex min-h-7 items-center px-2.5 text-[10px]"
        >
          Open Team Build
        </a>
      </div>
      {open && (
        <div className="mt-1.5 flex items-end gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TEAM_SLOT_INDEXES.map((i) => (
            <DockSlot
              key={i}
              index={i}
              monsterId={parseId(draft.members[i]?.monsterId ?? "")}
              eqId={parseId(draft.members[i]?.eqId ?? "")}
              size={size}
            />
          ))}
          <p
            className="ml-1 hidden min-w-0 flex-1 self-center truncate text-[10px] text-[var(--color-faint)] sm:block"
            title="Right-click (desktop) or long-press (touch) a result to change slots."
          >
            Right-click or long-press a result to change slots.
          </p>
        </div>
      )}
    </section>
  );
}
