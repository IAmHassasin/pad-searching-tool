import { useMemo, useState } from "react";
import type { DungeonFloorSummary } from "../dungeon-details/types";
import {
  buildHpTimeline,
  HEAVY_FLOOR_SHARE,
  heavyFloors,
  teamHpOnFloor,
  type TeamHpAt,
} from "../lib/team-build/floor-trial";
import {
  computeResilience,
  describeDefensiveEffect,
  type DefensiveOption,
} from "../lib/team-build/resilience";

type Props = {
  floors: DungeonFloorSummary[];
  /** Broken parts per floor index — owned by the page (it also drives the team totals). */
  partsBroken: ReadonlyMap<number, number>;
  onPartsBrokenChange: (next: Map<number, number>) => void;
  hpAt: TeamHpAt;
  leaderShields: number[];
  hpOptions: DefensiveOption[];
  shieldOptions: DefensiveOption[];
  slotLabel: (index: number) => string;
};

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  return n.toLocaleString("en-US");
}

type FloorPick = { hp: string | null; shield: string | null };

/**
 * Per-floor Resilience: broken parts per floor (Part Break Bonus), team HP where it
 * changes (Aging at floor 5 / 10, parts from the floor before), and every floor hitting
 * at least half of the dungeon's hardest hit with its own HP buff / shield choice.
 */
export function TrialFloorChecks({
  floors,
  partsBroken,
  onPartsBrokenChange,
  hpAt,
  leaderShields,
  hpOptions,
  shieldOptions,
  slotLabel,
}: Props) {
  const [picks, setPicks] = useState<Map<number, FloorPick>>(() => new Map());

  const partFloors = floors.filter((f) => f.partCount);
  const timeline = useMemo(
    () => buildHpTimeline(floors, partsBroken, hpAt),
    [floors, partsBroken, hpAt]
  );
  const heavy = useMemo(() => heavyFloors(floors), [floors]);

  const setParts = (index: number, value: number) =>
    onPartsBrokenChange(new Map(partsBroken).set(index, value));
  const setPick = (index: number, patch: Partial<FloorPick>) =>
    setPicks((prev) => {
      const cur = prev.get(index) ?? { hp: null, shield: null };
      return new Map(prev).set(index, { ...cur, ...patch });
    });

  const optionLabel = (o: DefensiveOption) =>
    `${slotLabel(o.slotIndex)} · ${o.source} · ${describeDefensiveEffect(o.effect)}`;

  return (
    <div className="space-y-3">
      {partFloors.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-[var(--color-muted)]">
            Parts broken (Part Break Bonus counts from the next floor; team totals use all of them)
          </p>
          {partFloors.map((f) => {
            const n = partsBroken.get(f.index) ?? 0;
            const max = f.partCount ?? 0;
            return (
              <div key={f.index} className="flex items-center gap-1.5 text-xs">
                <span className="w-16 shrink-0 font-mono font-semibold text-[var(--color-fg-strong)]">
                  {f.label}
                </span>
                <button
                  type="button"
                  aria-label={`${f.label}: one part fewer`}
                  disabled={n <= 0}
                  onClick={() => setParts(f.index, n - 1)}
                  className="ds-btn pressable h-7 w-7 text-sm disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-10 text-center font-mono tabular-nums">
                  {n} / {max}
                </span>
                <button
                  type="button"
                  aria-label={`${f.label}: one part more`}
                  disabled={n >= max}
                  onClick={() => setParts(f.index, n + 1)}
                  className="ds-btn pressable h-7 w-7 text-sm disabled:opacity-40"
                >
                  +
                </button>
                {f.floor == null && (
                  <span className="text-[10px] text-[var(--color-faint)]">
                    intrusion — counts on every floor once set
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs text-[var(--color-muted)]">Team HP by floor (only where it changes)</p>
        {timeline.map((row) => (
          <div key={row.fromIndex} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-mono text-[var(--color-fg-strong)]">
              {row.fromLabel}+
              {row.reasons.length > 0 && (
                <span className="ml-1.5 font-sans text-[10px] text-[var(--color-muted)]">
                  {row.reasons.join(" · ")}
                </span>
              )}
            </span>
            <span className="font-mono font-semibold tabular-nums text-pink-300">
              {formatNumber(row.hp)}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-[var(--color-muted)]">
          Heavy floors (hit ≥ {Math.round(HEAVY_FLOOR_SHARE * 100)}% of the dungeon max)
        </p>
        {heavy.map((f) => {
          const pick = picks.get(f.index) ?? { hp: null, shield: null };
          const hpOption = hpOptions.find((o) => o.id === pick.hp) ?? null;
          const shieldOption = shieldOptions.find((o) => o.id === pick.shield) ?? null;
          const { hp } = teamHpOnFloor(floors, f, partsBroken, hpAt);
          const result = computeResilience({
            teamHp: hp,
            leaderShields,
            hpBuff: hpOption?.effect.value ?? null,
            activeShield: shieldOption?.effect.value ?? null,
            maxDamage: f.maxHit?.value ?? null,
          });
          return (
            <div
              key={f.index}
              className="space-y-1.5 rounded-lg border border-white/[0.06] bg-black/20 p-2"
            >
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-mono font-semibold text-[var(--color-fg-strong)]">{f.label}</span>
                <span
                  className="font-mono font-semibold tabular-nums text-red-300"
                  title={f.maxHit?.raw}
                >
                  {formatNumber(f.maxHit?.value ?? 0)}
                </span>
              </div>
              {f.maxHit && (
                <p className="truncate text-[10px] text-[var(--color-faint)]" title={f.maxHit.raw}>
                  {f.maxHit.monsterNameJa ? `${f.maxHit.monsterNameJa} · ` : ""}
                  {f.maxHit.raw}
                </p>
              )}
              <div className="grid gap-1.5 sm:grid-cols-2">
                <select
                  aria-label={`${f.label}: HP buff active`}
                  value={pick.hp ?? ""}
                  onChange={(e) => setPick(f.index, { hp: e.target.value || null })}
                  className="ds-input min-h-8 min-w-0 px-1.5 py-0.5 text-[11px]"
                  disabled={hpOptions.length === 0}
                >
                  <option value="">{hpOptions.length ? "No HP buff" : "No HP-buff active"}</option>
                  {hpOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {optionLabel(o)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`${f.label}: shield active`}
                  value={pick.shield ?? ""}
                  onChange={(e) => setPick(f.index, { shield: e.target.value || null })}
                  className="ds-input min-h-8 min-w-0 px-1.5 py-0.5 text-[11px]"
                  disabled={shieldOptions.length === 0}
                >
                  <option value="">{shieldOptions.length ? "No shield" : "No shield active"}</option>
                  {shieldOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {optionLabel(o)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[11px]">
                <span className="text-[var(--color-muted)]">
                  HP <span className="font-mono tabular-nums text-pink-300">{formatNumber(result.effectiveMaxHp)}</span>
                  {" · "}cut {Math.round(result.totalReduction * 1000) / 10}%
                  {result.damageTaken != null && (
                    <>
                      {" · "}takes{" "}
                      <span className="font-mono tabular-nums text-red-300">
                        {formatNumber(result.damageTaken)}
                      </span>
                    </>
                  )}
                </span>
                {hp <= 0 ? (
                  <span className="text-[var(--color-amber-text)]">Add cards first</span>
                ) : (
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      result.survives ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"
                    }`}
                    role="status"
                  >
                    {result.survives ? "Survives" : "Dies"} · {result.survives ? "+" : "−"}
                    {formatNumber(Math.abs(result.margin ?? 0))}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
