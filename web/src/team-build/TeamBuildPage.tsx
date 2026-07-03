import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { fetchMonstersByIds } from "../api";
import { AppToolsNav } from "../components/AppToolsNav";
import { AwakeningSpriteIcon } from "../components/AwakeningSpriteIcon";
import { AwkModifierModal } from "../components/AwkModifierModal";
import { MonsterPortrait } from "../components/MonsterPortrait";
import { DEFAULT_AWK_MODIFIER_SETTINGS } from "../components/ResultsSortControls";
import { computeTeamStats } from "../lib/team-build/compute-stats";
import { lb110Percent, maxMonsterLevel } from "../lib/team-build/level-scaling";
import {
  exportTeamIdString,
  importTeamIdString,
} from "../lib/team-build/team-import-export";
import {
  listSuperAwakeningOptions,
  superAwakeningLabel,
} from "../lib/team-build/super-awakening-modifier";
import {
  BADGE_OPTIONS,
  LATENT_OPTIONS,
  latentSlotsUsed,
} from "../lib/team-build/stat-reference";
import {
  defaultTeamBuildConfig,
  type LatentId,
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
  return "";
}

function TeamStatLine({
  kind,
  value,
}: {
  kind: "hp" | "atk" | "rcv";
  value: number;
}) {
  const icon =
    kind === "hp" ? (
      <span className="text-[#f48fb1]" aria-hidden>
        ♥
      </span>
    ) : kind === "atk" ? (
      <span className="text-[#e0e0e0]" aria-hidden>
        ⚔
      </span>
    ) : (
      <span className="text-[#81d4fa]" aria-hidden>
        ✚
      </span>
    );

  return (
    <div className="flex items-center gap-1 text-[11px] leading-tight">
      <span className="w-3 shrink-0 text-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate font-semibold tabular-nums text-white">
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
      className={`flex w-[88px] shrink-0 flex-col items-center rounded-sm p-1 text-left transition-colors ${
        selected
          ? "bg-amber-950/50 ring-1 ring-amber-500/70"
          : "hover:bg-amber-950/30"
      }`}
    >
      {label && (
        <span className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-200/80">
          {label}
        </span>
      )}

      <div className="relative">
        <div className="h-[72px] w-[72px] overflow-hidden rounded border border-[#8b6914]/70 bg-[#1a1208]">
          {monsterId ? (
            <MonsterPortrait
              monsterId={monsterId}
              variant="icon"
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--color-muted)]">
              —
            </div>
          )}
        </div>

        {monsterId && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-0.5 bg-black/75 px-0.5 py-px">
            <span className="font-mono text-[8px] leading-none text-amber-100/90">
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
          <span className="absolute -right-1 -top-1 rounded bg-[#f9a825] px-1 text-[9px] font-bold leading-none text-[#3e2723] shadow">
            +{plusTotal}
          </span>
        )}

        {eqId && (
          <div className="absolute -bottom-1 -right-1 h-7 w-7 overflow-hidden rounded border border-[#6b8f3c]/80 bg-[#1a1208] shadow">
            <MonsterPortrait
              monsterId={eqId}
              variant="icon"
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>

      <div className="mt-1.5 w-full space-y-0.5 px-0.5">
        <TeamStatLine kind="hp" value={result?.hp.afterRaw ?? 0} />
        <TeamStatLine kind="atk" value={result?.atk.afterRaw ?? 0} />
        <TeamStatLine kind="rcv" value={result?.rcv.afterRaw ?? 0} />
      </div>

      {result?.error && (
        <span className="mt-0.5 max-w-full truncate text-[8px] text-red-400">
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
  const maxLatent = monster?.latent_slots ?? 6;
  const usedLatent = latentSlotsUsed(member.latents);

  const setLatent = (id: LatentId, count: number) => {
    const latents = { ...member.latents };
    if (count <= 0) delete latents[id];
    else latents[id] = count;
    onChange({ ...member, latents });
  };

  const saOptions = monster ? listSuperAwakeningOptions(monster) : [];
  const levelCap = monster ? maxMonsterLevel(monster) : 120;
  const transformForm = monster?.is_transform_form === true || monster?.is_transform_form === 1;

  const roleLabel =
    index === 0 ? "Leader" : index === 5 ? "Helper" : `Sub ${index}`;

  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--color-muted)]">
          {roleLabel}
        </span>
        {monster && (
          <span className="truncate text-xs text-[var(--color-accent)]">
            {monster.name_en ?? `#${monster.monster_id}`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-[var(--color-muted)]">Monster ID</span>
          <input
            type="text"
            inputMode="numeric"
            value={member.monsterId}
            onChange={(e) => onChange({ ...member, monsterId: e.target.value })}
            className="rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1"
            placeholder="e.g. 12806"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-[var(--color-muted)]">Eq ID</span>
          <input
            type="text"
            inputMode="numeric"
            value={member.eqId}
            onChange={(e) => onChange({ ...member, eqId: e.target.value })}
            className="rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1"
            placeholder="Assist"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-[var(--color-muted)]">Level</span>
          <select
            value={member.level}
            onChange={(e) =>
              onChange({
                ...member,
                level: Number(e.target.value) as MonsterLevelTarget,
              })
            }
            className="rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1"
          >
            <option value={99}>99</option>
            {levelCap >= 110 && <option value={110}>110 (LB)</option>}
            {levelCap >= 120 && <option value={120}>120 (SLB)</option>}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-[var(--color-muted)]">+HP</span>
          <input
            type="number"
            min={0}
            max={297}
            value={member.plusHp || ""}
            onChange={(e) =>
              onChange({ ...member, plusHp: Number(e.target.value) || 0 })
            }
            className="rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-[var(--color-muted)]">+ATK</span>
          <input
            type="number"
            min={0}
            max={297}
            value={member.plusAtk || ""}
            onChange={(e) =>
              onChange({ ...member, plusAtk: Number(e.target.value) || 0 })
            }
            className="rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-[var(--color-muted)]">+RCV</span>
          <input
            type="number"
            min={0}
            max={297}
            value={member.plusRcv || ""}
            onChange={(e) =>
              onChange({ ...member, plusRcv: Number(e.target.value) || 0 })
            }
            className="rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-[var(--color-muted)]">Eq +HP</span>
          <input
            type="number"
            min={0}
            max={99}
            value={member.eqPlusHp || ""}
            onChange={(e) =>
              onChange({ ...member, eqPlusHp: Number(e.target.value) || 0 })
            }
            className="rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-[var(--color-muted)]">Eq +RCV</span>
          <input
            type="number"
            min={0}
            max={99}
            value={member.eqPlusRcv || ""}
            onChange={(e) =>
              onChange({ ...member, eqPlusRcv: Number(e.target.value) || 0 })
            }
            className="rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1"
          />
        </label>
      </div>

      {saOptions.length > 0 && (
        <div className="mt-3">
          <span className="mb-1.5 block text-[10px] text-[var(--color-muted)]">
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
                  className={`rounded border p-0.5 transition-colors ${
                    selected
                      ? "border-amber-500 bg-amber-950/50 ring-1 ring-amber-500/60"
                      : "border-[var(--color-border)] hover:border-[var(--color-accent)]"
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
              className={`rounded border px-2 py-1 text-[10px] ${
                member.selectedSuperAwakening == null
                  ? "border-amber-500/70 bg-amber-950/40 text-amber-200"
                  : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
              }`}
            >
              None
            </button>
          </div>
        </div>
      )}

      {monster && (
        <p className="mt-2 text-[10px] text-[var(--color-muted)]">
          {transformForm ? (
            <>Transform form — max Lv.99</>
          ) : (
            <>
              LB +{lb110Percent(monster)}% (lm {monster.limit_mult ?? 0}, cost{" "}
              {monster.cost ?? "—"}) · latent {usedLatent}/{monster.latent_slots ?? 6}{" "}
              slots
            </>
          )}
        </p>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-[var(--color-muted)]">
          Latents ({usedLatent}/{maxLatent})
        </summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {LATENT_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="truncate">{opt.label}</span>
              <input
                type="number"
                min={0}
                max={8}
                value={member.latents[opt.id] ?? ""}
                onChange={(e) =>
                  setLatent(opt.id, Number(e.target.value) || 0)
                }
                className="w-14 rounded border border-[var(--color-border)] bg-[#0d1117] px-1 py-0.5 text-right"
              />
            </label>
          ))}
        </div>
      </details>
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
    <div className="rounded-lg border border-[#5d4a2a]/80 bg-[#1a1408]/90 px-4 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-amber-200/70">
        {label}
      </div>
      <div className={`text-lg font-bold tabular-nums ${accent}`}>
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

  const handleExport = async () => {
    const text = exportTeamIdString(config);
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg("Copied!");
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

  const exportedTeam = exportTeamIdString(config);

  const selectedMember = config.members[selectedSlot];
  const selectedMonster = parseId(selectedMember.monsterId)
    ? monstersById.get(parseId(selectedMember.monsterId)!) ?? null
    : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[#0d1117] px-4 py-2">
        <h1 className="text-base font-semibold">Team Build</h1>
        <div className="flex flex-wrap items-center gap-2">
          <AppToolsNav variant="inline" />
          <button
            type="button"
            className="rounded border border-[var(--color-border)] px-2 py-1 hover:border-[var(--color-accent)]"
            onClick={() => setAwkOpen(true)}
          >
            Dungeon awk
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-4xl">
          {/* Team row — PAD layout: Leader | 4 subs | Helper */}
          <div className="flex items-end justify-center gap-2 overflow-x-auto pb-2">
            <div className="shrink-0 rounded border-2 border-[#c9a227]/80 bg-[#2a1f0a]/60 p-1">
              <TeamSlotCard
                index={0}
                member={config.members[0]}
                result={resultBySlot.get(0)}
                selected={selectedSlot === 0}
                onSelect={() => setSelectedSlot(0)}
              />
            </div>

            <div className="flex shrink-0 gap-0.5 rounded border border-[#8b6914]/50 bg-[#1a1408]/50 p-1">
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

            <div className="shrink-0 rounded border-2 border-[#c9a227]/80 bg-[#2a1f0a]/60 p-1">
              <TeamSlotCard
                index={5}
                member={config.members[5]}
                result={resultBySlot.get(5)}
                selected={selectedSlot === 5}
                onSelect={() => setSelectedSlot(5)}
              />
            </div>
          </div>

          <p className="mb-4 text-center text-[10px] text-[var(--color-muted)]">
            Raw stats: level, +points, super awakening, latent, assist. No badge,
            leader skill, or dungeon awk.
          </p>

          {/* Team raw totals */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <TeamTotalBox
              label="Total HP"
              value={summary.teamRawHp}
              accent="text-[#f48fb1]"
            />
            <TeamTotalBox
              label="Total ATK"
              value={summary.teamRawAtk}
              accent="text-[#e0e0e0]"
            />
            <TeamTotalBox
              label="Total RCV"
              value={summary.teamRawRcv}
              accent="text-[#81d4fa]"
            />
          </div>

          <div className="mb-4 rounded border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase text-[var(--color-muted)]">
                Team IDs
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="rounded border border-[var(--color-border)] px-2 py-1 text-xs hover:border-[var(--color-accent)]"
                >
                  Copy export
                </button>
                {copyMsg && (
                  <span className="text-[10px] text-emerald-400">{copyMsg}</span>
                )}
              </div>
            </div>
            <output className="mb-2 block break-all rounded bg-[#0d1117] px-2 py-1.5 font-mono text-xs text-[var(--color-accent)]">
              {exportedTeam}
            </output>
            <p className="mb-2 text-[10px] text-[var(--color-muted)]">
              Order: leader · 4 subs · helper. Empty slot ={" "}
              <code className="text-[var(--color-accent)]">1</code>. Default +99
              all stats, Lv.120.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste ID string to import…"
                className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1 font-mono text-xs"
              />
              <button
                type="button"
                onClick={handleImport}
                disabled={!importText.trim()}
                className="shrink-0 rounded border border-[var(--color-border)] px-3 py-1 text-xs hover:border-[var(--color-accent)] disabled:opacity-40"
              >
                Import
              </button>
            </div>
            {importMsg && (
              <p className="mt-2 text-[10px] text-amber-300/90">{importMsg}</p>
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
              <div className="rounded border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
                <h2 className="mb-2 text-xs font-semibold uppercase text-[var(--color-muted)]">
                  Team settings
                </h2>
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
                    className="rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1"
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

              <div className="rounded border border-emerald-800/60 bg-emerald-950/30 p-3">
                <h2 className="mb-2 text-xs font-semibold uppercase text-emerald-200/80">
                  With badge + LS
                </h2>
                <div className="space-y-1 text-sm tabular-nums">
                  <div className="flex justify-between text-[#f48fb1]">
                    <span>HP</span>
                    <span>{summary.teamHp.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[#e0e0e0]">
                    <span>ATK</span>
                    <span>{summary.teamAtk.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[#81d4fa]">
                    <span>RCV</span>
                    <span>{summary.teamRcv.toLocaleString()}</span>
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
