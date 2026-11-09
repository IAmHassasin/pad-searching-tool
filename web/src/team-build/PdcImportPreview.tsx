import { useMemo } from "react";
import { MonsterPortrait } from "../components/MonsterPortrait";
import { pdcTeamToPst, type PdcTeam } from "../lib/team-build/pdc-team-string";
import { BADGE_OPTIONS } from "../lib/team-build/stat-reference";
import { TEAM_SIZE, defaultTeamBuildConfig } from "../lib/team-build/types";
import type { MonsterRecord } from "../types";

const SLOT_LABELS = ["Leader", "Sub 1", "Sub 2", "Sub 3", "Sub 4", "Helper"];

function plusText(hp: number, atk: number, rcv: number): string {
  const total = hp + atk + rcv;
  return total > 0 ? `+${total}` : "+0";
}

/** Read-only view of a team decoded from a PDC QR code, shown before it replaces the draft. */
export function PdcImportPreview({
  team,
  recordById,
}: {
  team: PdcTeam;
  recordById: ReadonlyMap<number, MonsterRecord>;
}) {
  const { config, warnings } = useMemo(() => pdcTeamToPst(team, defaultTeamBuildConfig()), [team]);
  const bySlot = new Map(team.members.map((m) => [m.slot, m]));
  const badgeLabel = BADGE_OPTIONS.find((b) => b.id === config.badge)?.label ?? config.badge;

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-[var(--color-muted)]">
        PDC team QR found. Apply replaces all 6 slots and the badge; dungeon and awakening
        settings stay. Badge: <span className="font-semibold text-[var(--color-fg-strong)]">{badgeLabel}</span>
      </p>
      {warnings.length > 0 && (
        <ul className="space-y-0.5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-2 py-1.5 text-[10px] text-amber-200">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {Array.from({ length: TEAM_SIZE }, (_, slot) => {
          const m = bySlot.get(slot);
          const name = m ? recordById.get(m.monsterId)?.name_en : undefined;
          return (
            <li key={slot} className="ds-card flex min-w-0 items-center gap-2 p-1.5">
              <span className="ds-label w-12 shrink-0">{SLOT_LABELS[slot]}</span>
              {m ? (
                <>
                  <MonsterPortrait monsterId={m.monsterId} variant="icon" alt="" className="h-10 w-10 shrink-0 rounded" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-[var(--color-fg-strong)]">
                      #{m.monsterId} {name ?? ""}
                    </p>
                    <p className="font-mono text-[10px] tabular-nums text-[var(--color-muted)]">
                      Lv{m.level} · {plusText(m.plusHp, m.plusAtk, m.plusRcv)}
                      {m.superAwakening > 0 ? ` · SA #${m.superAwakening}` : ""}
                      {m.latents.length > 0 ? ` · ${m.latents.length} latents` : ""}
                    </p>
                  </div>
                  {m.assist ? (
                    <div className="flex shrink-0 flex-col items-center" title={`Assist #${m.assist.id}`}>
                      <MonsterPortrait monsterId={m.assist.id} variant="icon" alt="" className="h-7 w-7 rounded" />
                      <span className="font-mono text-[9px] tabular-nums text-[var(--color-muted)]">
                        #{m.assist.id}
                      </span>
                    </div>
                  ) : (
                    <span className="shrink-0 text-[9px] text-[var(--color-faint)]">no assist</span>
                  )}
                </>
              ) : (
                <span className="text-[10px] text-[var(--color-faint)]">empty</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
