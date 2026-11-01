import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { fetchMonstersByIds } from "../api";
import { AwakeningSpriteIcon } from "../components/AwakeningSpriteIcon";
import { AwkModifierModal } from "../components/AwkModifierModal";
import { MonsterPortrait } from "../components/MonsterPortrait";
import { PageHeader } from "../components/PageHeader";
import { DEFAULT_AWK_MODIFIER_SETTINGS } from "../components/ResultsSortControls";
import { useTruncatedTitle } from "../hooks/useTruncatedTitle";
import { computeTeamStats } from "../lib/team-build/compute-stats";
import { lb110Percent, maxMonsterLevel } from "../lib/team-build/level-scaling";
import {
  exportTeamEqString,
  exportTeamIdString,
  exportTeamTsubakiString,
  importTeamIdString,
} from "../lib/team-build/team-import-export";
import {
  listSuperAwakeningOptions,
  superAwakeningLabel,
} from "../lib/team-build/super-awakening-modifier";
import {
  BADGE_OPTIONS,
} from "../lib/team-build/stat-reference";
import {
  defaultTeamBuildConfig,
  type MemberStatResult,
  type MonsterLevelTarget,
  type TeamBadgeId,
  type TeamBuildConfig,
  type TeamMemberConfig,
} from "../lib/team-build/types";
import type { MonsterRecord } from "../types";

function parseId(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function totalPlusPoints(member: TeamMemberConfig): number {
  return member.plusHp + member.plusAtk + member.plusRcv;
}

function slotLabel(index: number): string {
  if (index === 0) return "Leader";
  if (index === 5) return "Helper";
  return `Sub ${index}`;
}

/** Stat accent colors shared by slot lines and team totals. */
const STAT_TEXT = {
  hp: "text-pink-300",
  atk: "text-[var(--color-fg)]",
  rcv: "text-sky-300",
} as const;

const FIELD_INPUT =
  "ds-input min-h-9 px-2 py-1 font-mono text-sm tabular-nums";

function TeamStatLine({
  kind,
  value,
}: {
  kind: "hp" | "atk" | "rcv";
  value: number;
}) {
  const icon =
    kind === "hp" ? (
      <span className={STAT_TEXT.hp} aria-hidden>
        ♥
      </span>
    ) : kind === "atk" ? (
      <span className={STAT_TEXT.atk} aria-hidden>
        ⚔
      </span>
    ) : (
      <span className={STAT_TEXT.rcv} aria-hidden>
        ✚
      </span>
    );

  return (
    <div className="flex items-center gap-1 text-[11px] leading-tight">
      <span className="w-3 shrink-0 text-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate font-mono font-semibold tabular-nums text-[var(--color-fg-strong)]">
        {value > 0 ? value.toLocaleString() : "—"}
      </span>
    </div>
  );
}

function TeamSlotCard({
  index,
  member,
  result,
  selected,
  onSelect,
}: {
  index: number;
  member: TeamMemberConfig;
  result: MemberStatResult | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const monsterId = parseId(member.monsterId);
  const eqId = parseId(member.eqId);
  const plusTotal = totalPlusPoints(member);
  const label = slotLabel(index);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`pressable flex w-[96px] shrink-0 flex-col items-center rounded-xl border p-1.5 text-left ${
        selected
          ? "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)] shadow-[var(--shadow-glow)]"
          : "border-white/[0.06] bg-[var(--color-panel)]/90 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)]"
      }`}
    >
      {label && (
        <span
          className={`ds-label mb-1 ${
            selected || index === 0 || index === 5
              ? "text-[var(--color-accent-strong)]"
              : ""
          }`}
        >
          {label}
        </span>
      )}

      <div className="relative">
        <div className="h-[72px] w-[72px] overflow-hidden rounded-lg border border-white/10 bg-[var(--color-inset)]">
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
        </div>

        {monsterId && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-0.5 rounded-b-lg bg-black/75 px-0.5 py-px">
            <span className="font-mono text-[8px] font-bold leading-none tabular-nums text-[var(--color-accent-strong)]">
              {monsterId}
            </span>
            {member.selectedSuperAwakening != null && (
              <AwakeningSpriteIcon
                awokenSkillId={member.selectedSuperAwakening}
                size={11}
                title={superAwakeningLabel(member.selectedSuperAwakening)}
              />
            )}
          </div>
        )}

        {plusTotal > 0 && (
          <span className="absolute -right-1 -top-1 rounded bg-[var(--color-accent)] px-1 py-px font-mono text-[9px] font-bold leading-none tabular-nums text-slate-950 shadow-[var(--shadow-glow)]">
            +{plusTotal}
          </span>
        )}
      </div>

      {eqId && (
        <div className="mt-1 flex w-full justify-end pr-0.5">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-emerald-500/50 bg-[var(--color-inset)]">
            <MonsterPortrait
              monsterId={eqId}
              variant="icon"
              alt=""
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-0 left-0 max-w-[85%] truncate rounded-tr bg-black/75 px-0.5 py-px font-mono text-[8px] font-bold leading-none tabular-nums text-emerald-300">
              {eqId}
            </span>
          </div>
        </div>
      )}

      <div className="mt-1.5 w-full space-y-0.5 px-0.5">
        <TeamStatLine kind="hp" value={result?.hp.afterRaw ?? 0} />
        <TeamStatLine kind="atk" value={result?.atk.afterRaw ?? 0} />
        <TeamStatLine kind="rcv" value={result?.rcv.afterRaw ?? 0} />
      </div>

      {result?.error && (
        <span className="mt-0.5 max-w-full truncate text-[8px] text-[var(--color-negative)]">
          {result.error}
        </span>
      )}
    </button>
  );
}

function SlotEditor({
  index,
  member,
  monster,
  onChange,
}: {
  index: number;
  member: TeamMemberConfig;
  monster: MonsterRecord | null;
  onChange: (next: TeamMemberConfig) => void;
}) {
  const saOptions = monster ? listSuperAwakeningOptions(monster) : [];
  const levelCap = monster ? maxMonsterLevel(monster) : 120;
  const transformForm = monster?.is_transform_form === true || monster?.is_transform_form === 1;
  const nameTitle = useTruncatedTitle<HTMLSpanElement>(
    monster ? monster.name_en ?? `#${monster.monster_id}` : ""
  );

  const roleLabel =
    index === 0 ? "Leader" : index === 5 ? "Helper" : `Sub ${index}`;

  return (
    <div className="ds-card p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="ds-label shrink-0 text-[var(--color-accent-strong)]">
          {roleLabel}
        </span>
        {monster && (
          <span className="flex min-w-0 items-center gap-1.5">
            {monster.monster_id != null && (
              <span className="shrink-0 rounded-md bg-[var(--color-inset)] px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-[var(--color-accent-strong)] ring-1 ring-[var(--color-accent)]/20">
                #{monster.monster_id}
              </span>
            )}
            <span
              ref={nameTitle.ref}
              title={nameTitle.title}
              className="truncate text-xs font-semibold text-[var(--color-fg-strong)]"
            >
              {monster.name_en ?? `#${monster.monster_id}`}
            </span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">Monster ID</span>
          <input
            type="text"
            inputMode="numeric"
            value={member.monsterId}
            onChange={(e) => onChange({ ...member, monsterId: e.target.value })}
            className={FIELD_INPUT}
            placeholder="e.g. 12806"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">Eq ID</span>
          <input
            type="text"
            inputMode="numeric"
            value={member.eqId}
            onChange={(e) => onChange({ ...member, eqId: e.target.value })}
            className={FIELD_INPUT}
            placeholder="Assist"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">Level</span>
          <select
            value={member.level}
            onChange={(e) =>
              onChange({
                ...member,
                level: Number(e.target.value) as MonsterLevelTarget,
              })
            }
            className={FIELD_INPUT}
          >
            <option value={99}>99</option>
            {levelCap >= 110 && <option value={110}>110 (LB)</option>}
            {levelCap >= 120 && <option value={120}>120 (SLB)</option>}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">+HP</span>
          <input
            type="number"
            min={0}
            max={297}
            value={member.plusHp || ""}
            onChange={(e) =>
              onChange({ ...member, plusHp: Number(e.target.value) || 0 })
            }
            className={FIELD_INPUT}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">+ATK</span>
          <input
            type="number"
            min={0}
            max={297}
            value={member.plusAtk || ""}
            onChange={(e) =>
              onChange({ ...member, plusAtk: Number(e.target.value) || 0 })
            }
            className={FIELD_INPUT}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">+RCV</span>
          <input
            type="number"
            min={0}
            max={297}
            value={member.plusRcv || ""}
            onChange={(e) =>
              onChange({ ...member, plusRcv: Number(e.target.value) || 0 })
            }
            className={FIELD_INPUT}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">Eq +HP</span>
          <input
            type="number"
            min={0}
            max={99}
            value={member.eqPlusHp || ""}
            onChange={(e) =>
              onChange({ ...member, eqPlusHp: Number(e.target.value) || 0 })
            }
            className={FIELD_INPUT}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">Eq +RCV</span>
          <input
            type="number"
            min={0}
            max={99}
            value={member.eqPlusRcv || ""}
            onChange={(e) =>
              onChange({ ...member, eqPlusRcv: Number(e.target.value) || 0 })
            }
            className={FIELD_INPUT}
          />
        </label>
      </div>

      {saOptions.length > 0 && (
        <div className="mt-3">
          <span className="ds-label mb-1.5 block">
            Super awakening
          </span>
          <div className="flex flex-wrap gap-1.5">
            {saOptions.map((awkId) => {
              const selected = member.selectedSuperAwakening === awkId;
              return (
                <button
                  key={awkId}
                  type="button"
                  title={superAwakeningLabel(awkId)}
                  onClick={() =>
                    onChange({ ...member, selectedSuperAwakening: awkId })
                  }
                  aria-pressed={selected}
                  className={`pressable rounded border p-1 ${
                    selected
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] shadow-[var(--shadow-glow)]"
                      : "border-[var(--color-border)] bg-[var(--color-inset)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <AwakeningSpriteIcon awokenSkillId={awkId} size={22} />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() =>
                onChange({ ...member, selectedSuperAwakening: null })
              }
              aria-pressed={member.selectedSuperAwakening == null}
              className={`ds-pill pressable min-h-8 px-3 text-[11px] font-semibold ${
                member.selectedSuperAwakening == null ? "ds-pill-active" : ""
              }`}
            >
              None
            </button>
          </div>
        </div>
      )}

      {monster && (
        <p className="mt-3 border-t border-[var(--color-border)] pt-2 font-mono text-[10px] tabular-nums text-[var(--color-muted)]">
          {transformForm ? (
            <>Transform form — max Lv.99</>
          ) : (
            <>
              LB +{lb110Percent(monster)}% (lm {monster.limit_mult ?? 0}, cost{" "}
              {monster.cost ?? "—"})
            </>
          )}
        </p>
      )}

    </div>
  );
}

function TeamTotalBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="ds-card min-w-0 px-2 py-2 text-center sm:px-4">
      <div className="ds-label truncate">{label}</div>
      <div
        className={`truncate font-mono text-sm font-bold tabular-nums sm:text-lg ${accent}`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export function TeamBuildPage() {
  const [config, setConfig] = useState<TeamBuildConfig>(() =>
    defaultTeamBuildConfig(DEFAULT_AWK_MODIFIER_SETTINGS)
  );
  const [awkOpen, setAwkOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const idsToFetch = useMemo(() => {
    const ids = new Set<number>();
    for (const m of config.members) {
      const mid = parseId(m.monsterId);
      const eid = parseId(m.eqId);
      if (mid) ids.add(mid);
      if (eid) ids.add(eid);
    }
    return [...ids];
  }, [config.members]);

  const lookup = useQuery({
    queryKey: ["team-build", "lookup", idsToFetch],
    queryFn: () => fetchMonstersByIds(idsToFetch),
    enabled: idsToFetch.length > 0,
  });

  const monstersById = useMemo(() => {
    const map = new Map<number, MonsterRecord>();
    for (const row of lookup.data?.rows ?? []) {
      const id = row.monster_id ?? row.__source_pk;
      if (id != null) map.set(Number(id), row);
    }
    return map;
  }, [lookup.data]);

  useEffect(() => {
    setConfig((c) => {
      let changed = false;
      const members = c.members.map((m) => {
        const id = parseId(m.monsterId);
        if (!id) {
          if (m.selectedSuperAwakening != null) {
            changed = true;
            return { ...m, selectedSuperAwakening: null };
          }
          return m;
        }
        const row = monstersById.get(id);
        if (!row) return m;
        const cap = maxMonsterLevel(row);
        let next = m;
        if (m.level > cap) {
          changed = true;
          next = { ...m, level: cap };
        }
        const options = listSuperAwakeningOptions(row);
        if (!options.length) {
          if (next.selectedSuperAwakening != null) {
            changed = true;
            return { ...next, selectedSuperAwakening: null };
          }
          return next;
        }
        if (
          next.selectedSuperAwakening != null &&
          options.includes(next.selectedSuperAwakening)
        ) {
          return next;
        }
        if (next.selectedSuperAwakening == null) {
          return next;
        }
        changed = true;
        return { ...next, selectedSuperAwakening: null };
      });
      return changed ? { ...c, members } : c;
    });
  }, [monstersById]);

  const summary = useMemo(
    () => computeTeamStats(config, monstersById),
    [config, monstersById]
  );

  const resultBySlot = useMemo(() => {
    const map = new Map<number, MemberStatResult>();
    for (const m of summary.members) map.set(m.slotIndex, m);
    return map;
  }, [summary.members]);

  const updateMember = (index: number, next: TeamMemberConfig) => {
    setConfig((c) => ({
      ...c,
      members: c.members.map((m, i) => (i === index ? next : m)),
    }));
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`${label} copied`);
    } catch {
      setCopyMsg("Copy failed");
    }
    setTimeout(() => setCopyMsg(null), 2000);
  };

  const handleImport = () => {
    const { members, warnings } = importTeamIdString(
      importText,
      config.members
    );
    setConfig((c) => ({ ...c, members }));
    setImportMsg(
      warnings.length ? warnings.join(" ") : "Team imported."
    );
    setImportText("");
    setTimeout(() => setImportMsg(null), 4000);
  };

  const exportedMonsters = exportTeamIdString(config);
  const exportedEquipment = exportTeamEqString(config);
  const exportedTsubaki = exportTeamTsubakiString(config);

  const selectedMember = config.members[selectedSlot];
  const selectedMonster = parseId(selectedMember.monsterId)
    ? monstersById.get(parseId(selectedMember.monsterId)!) ?? null
    : null;

  return (
    <div className="flex h-full flex-col bg-[var(--color-surface)] text-[var(--color-fg)]">
      <PageHeader
        title="Team Build"
        subtitle="Team stat calculator"
        maxWidthClass="max-w-4xl"
        actions={
          <button
            type="button"
            className="ds-btn pressable min-h-9 px-3 text-xs font-semibold"
            onClick={() => setAwkOpen(true)}
          >
            Dungeon awk
          </button>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
        <div className="mx-auto max-w-4xl">
          {/* Team row — PAD layout: Leader | 4 subs | Helper (scrolls horizontally on narrow screens) */}
          <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
            <div className="mx-auto flex w-max items-end gap-2">
              <div className="shrink-0 rounded-2xl bg-[var(--color-accent)]/[0.06] p-1 ring-1 ring-[var(--color-accent)]/25">
                <TeamSlotCard
                  index={0}
                  member={config.members[0]}
                  result={resultBySlot.get(0)}
                  selected={selectedSlot === 0}
                  onSelect={() => setSelectedSlot(0)}
                />
              </div>

              <div className="flex shrink-0 gap-1 rounded-2xl bg-white/[0.02] p-1 ring-1 ring-white/[0.06]">
                {[1, 2, 3, 4].map((i) => (
                  <TeamSlotCard
                    key={i}
                    index={i}
                    member={config.members[i]}
                    result={resultBySlot.get(i)}
                    selected={selectedSlot === i}
                    onSelect={() => setSelectedSlot(i)}
                  />
                ))}
              </div>

              <div className="shrink-0 rounded-2xl bg-[var(--color-accent)]/[0.06] p-1 ring-1 ring-[var(--color-accent)]/25">
                <TeamSlotCard
                  index={5}
                  member={config.members[5]}
                  result={resultBySlot.get(5)}
                  selected={selectedSlot === 5}
                  onSelect={() => setSelectedSlot(5)}
                />
              </div>
            </div>
          </div>

          <p className="mb-4 text-center text-[10px] text-[var(--color-faint)]">
            Raw stats: level, +points, super awakening, assist. No badge,
            leader skill, or dungeon awk.
          </p>

          {/* Team raw totals */}
          <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
            <TeamTotalBox
              label="Total HP"
              value={summary.teamRawHp}
              accent={STAT_TEXT.hp}
            />
            <TeamTotalBox
              label="Total ATK"
              value={summary.teamRawAtk}
              accent={STAT_TEXT.atk}
            />
            <TeamTotalBox
              label="Total RCV"
              value={summary.teamRawRcv}
              accent={STAT_TEXT.rcv}
            />
          </div>

          <div className="ds-card mb-4 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="ds-label">Team IDs</h2>
              {copyMsg && (
                <span className="text-[10px] font-semibold text-[var(--color-positive)]">
                  {copyMsg}
                </span>
              )}
            </div>

            <div className="mb-3 space-y-2">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="ds-label text-[var(--color-faint)]">
                    Monsters
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(exportedMonsters, "Monsters")}
                    className="ds-btn pressable min-h-8 px-3 text-[11px] font-semibold"
                  >
                    Copy
                  </button>
                </div>
                <output className="block break-all rounded-lg bg-[var(--color-inset)] px-2 py-1.5 font-mono text-xs tabular-nums text-[var(--color-accent-strong)] ring-1 ring-white/[0.04]">
                  {exportedMonsters}
                </output>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="ds-label text-[var(--color-faint)]">
                    Equipment
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(exportedEquipment, "Equipment")}
                    className="ds-btn pressable min-h-8 px-3 text-[11px] font-semibold"
                  >
                    Copy
                  </button>
                </div>
                <output className="block break-all rounded-lg bg-[var(--color-inset)] px-2 py-1.5 font-mono text-xs tabular-nums text-emerald-300 ring-1 ring-white/[0.04]">
                  {exportedEquipment}
                </output>
              </div>
            </div>

            <div className="mb-3 border-t border-[var(--color-border)] pt-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="ds-label text-[var(--color-faint)]">
                  Tsubaki
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(exportedTsubaki, "Tsubaki")}
                  className="pressable min-h-8 rounded-lg border border-[var(--color-secondary)]/40 bg-[var(--color-secondary-muted)] px-3 text-[11px] font-semibold text-[var(--color-secondary-strong)] hover:border-[var(--color-secondary)]"
                >
                  Copy for Tsubaki
                </button>
              </div>
              <output className="block break-all rounded-lg bg-[var(--color-inset)] px-2 py-1.5 font-mono text-xs tabular-nums text-[var(--color-secondary-strong)] ring-1 ring-white/[0.04]">
                {exportedTsubaki}
              </output>
            </div>

            <p className="mb-2 text-[10px] text-[var(--color-muted)]">
              Order: leader · 4 subs · helper. Empty slot ={" "}
              <code className="font-mono font-bold text-[var(--color-accent-strong)]">1</code>. Import: line 1
              monsters, line 2 equipment.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                rows={2}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste monster IDs (line 1) and optional eq IDs (line 2)…"
                className="ds-input min-w-0 flex-1 resize-y px-2 py-1.5 font-mono text-xs"
              />
              <button
                type="button"
                onClick={handleImport}
                disabled={!importText.trim()}
                className="ds-btn-primary pressable min-h-10 shrink-0 px-4 text-xs disabled:cursor-not-allowed"
              >
                Import
              </button>
            </div>
            {importMsg && (
              <p className="mt-2 text-[10px] text-[var(--color-amber-text)]">{importMsg}</p>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <SlotEditor
              index={selectedSlot}
              member={selectedMember}
              monster={selectedMonster}
              onChange={(next) => updateMember(selectedSlot, next)}
            />

            <aside className="flex flex-col gap-3">
              <div className="ds-card p-3">
                <h2 className="ds-label mb-2">Team settings</h2>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-[var(--color-muted)]">Badge</span>
                  <select
                    value={config.badge}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        badge: e.target.value as TeamBadgeId,
                      }))
                    }
                    className="ds-input min-h-9 px-2 py-1"
                  >
                    {BADGE_OPTIONS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-2 text-[10px] text-[var(--color-muted)]">
                  Badge & leader skill affect team totals below, not slot raw stats.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--color-positive)]/25 bg-[var(--color-positive)]/[0.06] p-3">
                <h2 className="ds-label mb-2 text-emerald-300">
                  With badge + LS
                </h2>
                <div className="space-y-1 text-sm">
                  <div className={`flex justify-between ${STAT_TEXT.hp}`}>
                    <span className="font-semibold">HP</span>
                    <span className="font-mono font-bold tabular-nums">{summary.teamHp.toLocaleString()}</span>
                  </div>
                  <div className={`flex justify-between ${STAT_TEXT.atk}`}>
                    <span className="font-semibold">ATK</span>
                    <span className="font-mono font-bold tabular-nums">{summary.teamAtk.toLocaleString()}</span>
                  </div>
                  <div className={`flex justify-between ${STAT_TEXT.rcv}`}>
                    <span className="font-semibold">RCV</span>
                    <span className="font-mono font-bold tabular-nums">{summary.teamRcv.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <AwkModifierModal
        open={awkOpen}
        stat="hp"
        settings={config.awkSettings}
        onChange={(awkSettings) => setConfig((c) => ({ ...c, awkSettings }))}
        onClose={() => setAwkOpen(false)}
      />
    </div>
  );
}
