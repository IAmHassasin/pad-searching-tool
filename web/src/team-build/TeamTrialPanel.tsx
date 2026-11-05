import { useMemo, useState } from "react";
import type { DungeonSummary } from "../dungeon-details/types";
import { stripPadTitle } from "../dungeon-details/utils";
import type { DungeonCatalogEntry } from "../lib/team-build/dungeon-catalog";
import type { ResolvedMaxHit } from "../lib/team-build/dungeon-sources";
import {
  computeResilience,
  describeDefensiveEffect,
  leaderShieldOf,
  listDefensiveOptions,
  type DefensiveOption,
} from "../lib/team-build/resilience";
import type { TeamBuildConfig } from "../lib/team-build/types";
import type { MonsterRecord } from "../types";

type Props = {
  config: TeamBuildConfig;
  monstersById: Map<number, MonsterRecord>;
  /** Team total HP (LS HP × badge × dungeon × team awakenings). */
  teamHp: number;
  slotLabel: (index: number) => string;
  /** Dungeon selected in Team settings (same list as the picker). */
  entry: DungeonCatalogEntry | null;
  dungeonLabel: string;
  /** Imported floor table linked to `entry`, when there is one. */
  seed: DungeonSummary | null;
  /** Hardest hit: floor table first, else the value scraped into the catalog. */
  maxHit: ResolvedMaxHit | null;
  listStatus: "pending" | "error" | "success";
  listError: string | null;
  onOpenDungeon: () => void;
  onClose: () => void;
};

/** Checks offered by the trial. Only Resilience is implemented today. */
const TRIAL_CHECKS: ReadonlyArray<{
  id: string;
  label: string;
  hint: string;
  available: boolean;
}> = [
  {
    id: "resilience",
    label: "Resilience",
    hint: "Survive the dungeon's hardest hit at full HP",
    available: true,
  },
  {
    id: "mimic",
    label: "Mimic check (OE+, Blind, Tape, Cloud, …)",
    hint: "Not available yet",
    available: false,
  },
  { id: "recover", label: "Recover check", hint: "Not available yet", available: false },
  { id: "assist-recover", label: "Assist recover", hint: "Not available yet", available: false },
  { id: "damage", label: "Average / Max damage", hint: "Not available yet", available: false },
];

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  return n.toLocaleString("en-US");
}

function OptionRadio({
  name,
  checked,
  label,
  detail,
  onChange,
}: {
  name: string;
  checked: boolean;
  label: string;
  detail?: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5 text-xs ${
        checked
          ? "border-[var(--color-accent)]/60 bg-[var(--color-accent-muted)]"
          : "border-white/[0.06] bg-[var(--color-inset)]/60 hover:border-[var(--color-border-strong)]"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-[var(--color-accent)]"
      />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[var(--color-fg-strong)]">{label}</span>
        {detail && (
          <span className="block truncate text-[10px] text-[var(--color-muted)]">{detail}</span>
        )}
      </span>
    </label>
  );
}

function StatRow({
  label,
  value,
  accent,
  title,
}: {
  label: string;
  value: string;
  accent?: string;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs" title={title}>
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className={`font-mono font-semibold tabular-nums ${accent ?? "text-[var(--color-fg-strong)]"}`}>
        {value}
      </span>
    </div>
  );
}

/**
 * Trial mode: run checks against the current team for the dungeon chosen in
 * Team settings. Resilience compares the dungeon's hardest hit (imported
 * floor table) with the team's effective HP, with one HP-buff active and one
 * shield active selectable on top of the leader-skill shields.
 */
export function TeamTrialPanel({
  config,
  monstersById,
  teamHp,
  slotLabel,
  entry,
  dungeonLabel,
  seed,
  maxHit,
  listStatus,
  listError,
  onOpenDungeon,
  onClose,
}: Props) {
  const [includeLeaderShield, setIncludeLeaderShield] = useState(true);
  const [hpOptionId, setHpOptionId] = useState<string | null>(null);
  const [shieldOptionId, setShieldOptionId] = useState<string | null>(null);

  const options = useMemo(
    () => listDefensiveOptions(config, monstersById),
    [config, monstersById]
  );
  const hpOptions = options.filter((o) => o.effect.kind === "hp");
  const shieldOptions = options.filter((o) => o.effect.kind === "shield");
  // Derived rather than synced: a removed card simply drops its selection.
  const hpOption = hpOptions.find((o) => o.id === hpOptionId) ?? null;
  const shieldOption = shieldOptions.find((o) => o.id === shieldOptionId) ?? null;

  const leaders = config.members
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => m.role === "leader")
    .map(({ m, index }) => {
      const id = Number(m.monsterId.trim());
      const row = Number.isFinite(id) && id > 0 ? monstersById.get(id) ?? null : null;
      return { index, row, shield: leaderShieldOf(row) };
    });

  const maxDamage = maxHit;
  const result = computeResilience({
    teamHp,
    leaderShields: includeLeaderShield ? leaders.map((l) => l.shield) : [],
    hpBuff: hpOption?.effect.value ?? null,
    activeShield: shieldOption?.effect.value ?? null,
    maxDamage: maxDamage?.value ?? null,
  });

  const optionLabel = (o: DefensiveOption) =>
    `${slotLabel(o.slotIndex)} · ${o.source} · ${describeDefensiveEffect(o.effect)}`;
  const optionDetail = (o: DefensiveOption) =>
    o.skillName ? `${o.monsterName} — ${o.skillName}` : o.monsterName;

  const hasDungeon = entry != null || config.dungeonId === "custom";

  return (
    <section className="ds-card mb-3 p-3" aria-label="Trial">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden className="text-base leading-none text-[var(--color-accent-strong)]">
          ⇒
        </span>
        <h2 className="ds-label">Trial · test the team against the selected dungeon</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close trial"
          className="pressable ml-auto flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-sm leading-none text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-fg-strong)]"
        >
          ×
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Dungeon + checks */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-[var(--color-muted)]">Dungeon (from Team settings)</span>
            <button
              type="button"
              onClick={onOpenDungeon}
              className="ds-input pressable flex min-h-9 items-center justify-between gap-2 px-2 py-1 text-left text-xs"
              title="Change the dungeon (same list as Team settings)"
            >
              <span className="truncate font-semibold text-[var(--color-fg-strong)]">
                {dungeonLabel}
              </span>
              <span className="shrink-0 text-[10px] font-semibold text-[var(--color-accent-strong)]">
                Change
              </span>
            </button>
            {seed ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--color-muted)]">
                <span className="truncate" title={seed.titleJa}>
                  {stripPadTitle(seed.titleJa)}
                </span>
                <a
                  href={seed.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="pressable rounded bg-white/5 px-1.5 py-px font-semibold text-[var(--color-muted)] hover:text-[var(--color-accent-strong)]"
                >
                  Source ↗
                </a>
                <a
                  href={`/dungeon-details/${seed.appmediaPostId}`}
                  className="pressable rounded bg-white/5 px-1.5 py-px font-semibold text-[var(--color-muted)] hover:text-[var(--color-accent-strong)]"
                >
                  Floor table
                </a>
              </div>
            ) : !hasDungeon ? (
              <p className="text-[10px] text-[var(--color-muted)]">
                No dungeon selected — pick one to run the checks.
              </p>
            ) : maxHit ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--color-muted)]">
                <span>Max hit from {maxHit.source === "kamigame" ? "Kamigame" : "AppMedia"} enemy table</span>
                <a
                  href={maxHit.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="pressable rounded bg-white/5 px-1.5 py-px font-semibold text-[var(--color-muted)] hover:text-[var(--color-accent-strong)]"
                >
                  Source ↗
                </a>
              </div>
            ) : listStatus === "pending" ? (
              <p className="text-[10px] text-[var(--color-muted)]">Loading floor tables…</p>
            ) : listStatus === "error" ? (
              <p className="text-[10px] text-[var(--color-negative)]">
                {listError ?? "Failed to load floor tables"}
              </p>
            ) : (
              <p className="text-[10px] text-[var(--color-amber-text)]">
                No max hit known for this dungeon yet (no floor table imported and nothing scraped).
              </p>
            )}
          </div>

          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs text-[var(--color-muted)]">Checks</legend>
            {TRIAL_CHECKS.map((check) => (
              <label
                key={check.id}
                className={`flex items-center gap-2 text-xs ${
                  check.available
                    ? "text-[var(--color-fg-strong)]"
                    : "cursor-not-allowed text-[var(--color-faint)]"
                }`}
                title={check.hint}
              >
                <input
                  type="checkbox"
                  checked={check.available}
                  disabled={!check.available}
                  readOnly
                  className="accent-[var(--color-accent)] disabled:opacity-40"
                />
                <span>{check.label}</span>
                {!check.available && (
                  <span className="rounded-full border border-white/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide">
                    soon
                  </span>
                )}
              </label>
            ))}
          </fieldset>
        </div>

        {/* Resilience */}
        <div className="min-w-0 space-y-3 rounded-xl border border-white/[0.06] bg-[var(--color-inset)]/40 p-2.5">
          <h3 className="ds-label text-[var(--color-accent-strong)]">Resilience</h3>

          <div className="space-y-1">
            <StatRow
              label="Dungeon max hit"
              value={maxDamage ? formatNumber(maxDamage.value) : "—"}
              accent="text-red-300"
              title={
                maxDamage
                  ? `${maxDamage.floor ?? "?"} · ${maxDamage.monsterNameJa ?? ""} · ${maxDamage.raw}`
                  : undefined
              }
            />
            {maxDamage && (
              <p className="truncate text-[10px] text-[var(--color-faint)]">
                {maxDamage.floor ?? "?"}
                {maxDamage.monsterNameJa ? ` · ${maxDamage.monsterNameJa}` : ""} · {maxDamage.raw}
              </p>
            )}
            <StatRow
              label="Team HP"
              value={formatNumber(teamHp)}
              accent="text-pink-300"
              title="Total HP with leader-skill HP, badge, dungeon modifiers and team awakenings"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--color-fg-strong)]">
            <input
              type="checkbox"
              checked={includeLeaderShield}
              onChange={(e) => setIncludeLeaderShield(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            <span>
              Leader-skill shields (max):{" "}
              {leaders.map((l, i) => (
                <span key={l.index} className="font-mono tabular-nums">
                  {i > 0 ? " · " : ""}
                  {slotLabel(l.index)} {Math.round(l.shield * 100)}%
                </span>
              ))}
            </span>
          </label>

          <div className="space-y-1">
            <p className="text-xs text-[var(--color-muted)]">HP buff active (one at a time)</p>
            <OptionRadio
              name="trial-hp"
              checked={hpOption == null}
              label="None"
              onChange={() => setHpOptionId(null)}
            />
            {hpOptions.map((o) => (
              <OptionRadio
                key={o.id}
                name="trial-hp"
                checked={hpOption?.id === o.id}
                label={optionLabel(o)}
                detail={optionDetail(o)}
                onChange={() => setHpOptionId(o.id)}
              />
            ))}
            {hpOptions.length === 0 && (
              <p className="text-[10px] text-[var(--color-faint)]">No HP-buff active on the team.</p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-[var(--color-muted)]">Shield active (one at a time)</p>
            <OptionRadio
              name="trial-shield"
              checked={shieldOption == null}
              label="None"
              onChange={() => setShieldOptionId(null)}
            />
            {shieldOptions.map((o) => (
              <OptionRadio
                key={o.id}
                name="trial-shield"
                checked={shieldOption?.id === o.id}
                label={optionLabel(o)}
                detail={optionDetail(o)}
                onChange={() => setShieldOptionId(o.id)}
              />
            ))}
            {shieldOptions.length === 0 && (
              <p className="text-[10px] text-[var(--color-faint)]">No shield active on the team.</p>
            )}
          </div>

          <div className="space-y-1 border-t border-white/[0.06] pt-2">
            <StatRow label="Effective max HP" value={formatNumber(result.effectiveMaxHp)} accent="text-pink-300" />
            <StatRow
              label="Damage reduction"
              value={`${Math.round(result.totalReduction * 1000) / 10}%`}
            />
            <StatRow
              label="Effective HP"
              value={formatNumber(Math.round(result.effectiveHp))}
              accent="text-pink-300"
              title="Effective max HP ÷ (1 − damage reduction)"
            />
            {result.damageTaken != null && (
              <StatRow label="Damage taken" value={formatNumber(result.damageTaken)} accent="text-red-300" />
            )}
            {!hasDungeon ? (
              <p className="pt-1 text-xs text-[var(--color-muted)]">
                Pick a dungeon in Team settings to run the check.
              </p>
            ) : !maxDamage ? (
              <p className="pt-1 text-xs text-[var(--color-amber-text)]">
                No max hit known for this dungeon.
              </p>
            ) : teamHp <= 0 ? (
              <p className="pt-1 text-xs text-[var(--color-amber-text)]">Add cards to the team first.</p>
            ) : (
              <p
                className={`pt-1 font-mono text-sm font-bold tabular-nums ${
                  result.survives ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"
                }`}
                role="status"
              >
                {result.survives ? "Survives" : "Dies"} · {result.survives ? "HP left" : "short by"}{" "}
                {formatNumber(Math.abs(result.margin ?? 0))}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
