import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMonstersByIds } from "../api";
import { AwakeningSpriteIcon } from "../components/AwakeningSpriteIcon";
import { AwkModifierModal } from "../components/AwkModifierModal";
import { MonsterPortrait } from "../components/MonsterPortrait";
import { PageHeader } from "../components/PageHeader";
import { ResizableSidePanel } from "../components/ResizableSidePanel";
import {
  QuickSearchProvider,
  useQuickSearch,
} from "../components/quick-search/QuickSearchContext";
import { QuickSearchIdInput } from "../components/quick-search/QuickSearchIdInput";
import { QuickSearchLayout } from "../components/quick-search/QuickSearchLayout";
import { MonsterNameTranslationProvider } from "../hooks/useLiveMonsterNames";
import { useDungeonEntries } from "../hooks/useDungeonEntries";
import { useMobileWebview } from "../hooks/useMobileWebview";
import { useResizablePanel } from "../hooks/useResizablePanel";
import { useTeamDraft } from "../hooks/useTeamDraft";
import { parseRegularAwakenings } from "../lib/awakenings";
import {
  computeTeamStats,
  partBreakCopiesForSlot,
} from "../lib/team-build/compute-stats";
import {
  clampPartsBroken,
  MAX_PARTS_BROKEN,
  PART_BREAK_AWAKENING_ID,
} from "../lib/part-break";
import {
  describeDungeonModifiers,
  resolveDungeonModifiers,
} from "../lib/team-build/dungeon-modifiers";
import { maxHitForEntry, seedForEntry } from "../lib/team-build/dungeon-sources";
import {
  defaultPartsBroken,
  hasUsableFloorTable,
  teamHpAtState,
  totalPartsBroken,
  type FloorState,
} from "../lib/team-build/floor-trial";
import {
  combineLeaderMultipliers,
  leaderMultipliersForMember,
} from "../lib/team-build/leader-skill";
import { lb110Percent, maxMonsterLevel } from "../lib/team-build/level-scaling";
import { maxOutMembers } from "../lib/team-build/max-out";
import {
  detransformableSlots,
  detransformMembers,
  transformableSlots,
  transformMembers,
} from "../lib/team-build/transform";
import { grantedAssistAwakenings } from "../lib/team-build/passive-awakenings";
import { describeSlotContributions } from "../lib/team-build/stat-contributions";
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
import { BADGE_OPTIONS } from "../lib/team-build/stat-reference";
import {
  type MemberStatResult,
  type MonsterLevelTarget,
  type TeamBadgeId,
  type TeamMemberConfig,
} from "../lib/team-build/types";
import type { MonsterRecord } from "../types";
import { DungeonPickerModal } from "./DungeonPickerModal";
import { ScreenshotImportModal } from "./ScreenshotImportModal";
import { TeamAwakeningPanel } from "./TeamAwakeningPanel";
import { TeamAwakeningSummary } from "./TeamAwakeningSummary";
import { TeamCardSheet } from "./TeamCardSheet";
import { TeamTrialPanel } from "./TeamTrialPanel";

/** Part Break Bonus is driven by the Team settings parts counter, not the manual list. */
const HIDDEN_MANUAL_AWAKENING_IDS: readonly number[] = [PART_BREAK_AWAKENING_ID];

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
  "ds-input min-h-9 w-full px-2 py-1 font-mono text-sm tabular-nums";

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
  dungeonLabel,
}: {
  index: number;
  member: TeamMemberConfig;
  result: MemberStatResult | undefined;
  selected: boolean;
  onSelect: () => void;
  dungeonLabel?: string | null;
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
      title={
        selected
          ? "Click again to go back to the team view"
          : monsterId
            ? "Click to edit or replace this card"
            : "Click to pick a card"
      }
      className={`pressable flex w-[96px] shrink-0 flex-col items-center rounded-xl border p-1.5 text-left ${
        selected
          ? "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)] shadow-[var(--shadow-glow)]"
          : "border-white/[0.06] bg-[var(--color-panel)]/90 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)]"
      }`}
    >
      <span
        className={`ds-label mb-1 ${
          selected || index === 0 || index === 5
            ? "text-[var(--color-accent-strong)]"
            : ""
        }`}
      >
        {label}
      </span>

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
              + card
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
        <TeamStatLine kind="hp" value={result?.hp.afterDungeon ?? 0} />
        <TeamStatLine kind="atk" value={result?.atk.afterDungeon ?? 0} />
        <TeamStatLine kind="rcv" value={result?.rcv.afterDungeon ?? 0} />
      </div>

      {dungeonLabel && (
        <span
          className="mt-1 max-w-full truncate rounded-full border border-[var(--color-secondary)]/30 bg-[var(--color-inset)]/70 px-1.5 py-px font-mono text-[8px] font-semibold text-[var(--color-secondary-strong)]"
          title={`Stats inside ${dungeonLabel}`}
        >
          {dungeonLabel}
        </span>
      )}

      {result?.error && (
        <span className="mt-0.5 max-w-full truncate text-[8px] text-[var(--color-negative)]">
          {result.error}
        </span>
      )}
    </button>
  );
}

/** Numeric fields of the selected slot (IDs via quick search, level, +points). */
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
  const levelCap = monster ? maxMonsterLevel(monster) : 120;
  const transformForm =
    monster?.is_transform_form === true || monster?.is_transform_form === 1;
  const roleLabel = slotLabel(index);

  const numField = (
    label: string,
    key: "plusHp" | "plusAtk" | "plusRcv" | "eqPlusHp" | "eqPlusAtk" | "eqPlusRcv",
    max: number
  ) => (
    <label className="flex flex-col gap-0.5">
      <span className="ds-label">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={member[key] || ""}
        onChange={(e) => onChange({ ...member, [key]: Number(e.target.value) || 0 })}
        className={FIELD_INPUT}
      />
    </label>
  );

  return (
    <div className="ds-card p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="ds-label text-[var(--color-accent-strong)]">{roleLabel} · settings</span>
        {monster && (
          <span className="font-mono text-[10px] tabular-nums text-[var(--color-muted)]">
            {transformForm
              ? "Transform form — max Lv.99"
              : `LB +${lb110Percent(monster)}% (lm ${monster.limit_mult ?? 0}, cost ${monster.cost ?? "—"})`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <span className="ds-label col-span-3 text-[var(--color-muted)]">Card</span>
        <label className="col-span-2 flex flex-col gap-0.5">
          <span className="ds-label">Monster ID</span>
          <QuickSearchIdInput
            type="text"
            inputMode="numeric"
            value={member.monsterId}
            onChange={(e) => onChange({ ...member, monsterId: e.target.value })}
            className={FIELD_INPUT}
            placeholder="e.g. 12806"
            targetKey={`slot-${index}-monster`}
            targetLabel={`${roleLabel} · Monster ID`}
            onPickId={(id) =>
              onChange({ ...member, monsterId: String(id), selectedSuperAwakening: null })
            }
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">Level</span>
          <select
            value={member.level}
            onChange={(e) =>
              onChange({ ...member, level: Number(e.target.value) as MonsterLevelTarget })
            }
            className={FIELD_INPUT}
          >
            <option value={99}>99</option>
            {levelCap >= 110 && <option value={110}>110 (LB)</option>}
            {levelCap >= 120 && <option value={120}>120 (SLB)</option>}
          </select>
        </label>
        {numField("+HP", "plusHp", 297)}
        {numField("+ATK", "plusAtk", 297)}
        {numField("+RCV", "plusRcv", 297)}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-sm">
        <span className="ds-label col-span-3 text-emerald-300/80">Assist</span>
        <label className="col-span-3 flex flex-col gap-0.5">
          <span className="ds-label">Eq ID</span>
          <QuickSearchIdInput
            type="text"
            inputMode="numeric"
            value={member.eqId}
            onChange={(e) => onChange({ ...member, eqId: e.target.value })}
            className={FIELD_INPUT}
            placeholder="Assist"
            targetKey={`slot-${index}-assist`}
            targetLabel={`${roleLabel} · Eq ID`}
            onPickId={(id) => onChange({ ...member, eqId: String(id) })}
          />
        </label>
        {numField("Eq +HP", "eqPlusHp", 297)}
        {numField("Eq +ATK", "eqPlusAtk", 297)}
        {numField("Eq +RCV", "eqPlusRcv", 297)}
      </div>
    </div>
  );
}

/** Team total with the raw value (no LS / dungeon / badge) as a secondary line. */
function TeamTotalBox({
  label,
  value,
  raw,
  accent,
}: {
  label: string;
  value: number;
  raw: number;
  accent: string;
}) {
  return (
    <div className="ds-card min-w-0 px-2 py-2 text-center sm:px-4">
      <div className="ds-label truncate">{label}</div>
      <div className={`truncate font-mono text-sm font-bold tabular-nums sm:text-lg ${accent}`}>
        {value.toLocaleString()}
      </div>
      <div
        className="truncate font-mono text-[10px] tabular-nums text-[var(--color-muted)]"
        title="Raw total: no leader skill, dungeon or badge"
      >
        raw {raw.toLocaleString()}
      </div>
    </div>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
  accent,
  buttonLabel = "Copy",
}: {
  label: string;
  value: string;
  onCopy: () => void;
  accent: string;
  buttonLabel?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="ds-label text-[var(--color-faint)]">{label}</span>
        <button
          type="button"
          onClick={onCopy}
          className="ds-btn pressable min-h-8 px-3 text-[11px] font-semibold"
        >
          {buttonLabel}
        </button>
      </div>
      <output
        className={`block break-all rounded-lg bg-[var(--color-inset)] px-2 py-1.5 font-mono text-xs tabular-nums ring-1 ring-white/[0.04] ${accent}`}
      >
        {value}
      </output>
    </div>
  );
}

export function TeamBuildPage() {
  const isMobile = useMobileWebview();
  return (
    <QuickSearchProvider defaultExpanded={!isMobile}>
      <MonsterNameTranslationProvider>
        <TeamBuildPageInner isMobile={isMobile} />
      </MonsterNameTranslationProvider>
    </QuickSearchProvider>
  );
}

function TeamBuildPageInner({ isMobile }: { isMobile: boolean }) {
  // Persisted draft: shared with the search page's slot picker and restored
  // after a reload / tab switch.
  const { draft: config, setDraft: setConfig, clearMembers } = useTeamDraft();
  const qs = useQuickSearch();
  const [awkOpen, setAwkOpen] = useState(false);
  const [dungeonOpen, setDungeonOpen] = useState(false);
  // Trial mode: test the team against an imported dungeon (panel under the totals).
  const [trialOpen, setTrialOpen] = useState(false);
  // null = no slot selected: the page shows the team-wide awakening summary.
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [idsOpen, setIdsOpen] = useState(false);
  const [screenshotOpen, setScreenshotOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  /** Feedback line under the team actions (Max all / Transform / De-transform). */
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const awkPanel = useResizablePanel({
    storageKey: "team-awakenings",
    side: "right",
    defaultWidth: 340,
    minWidth: 280,
    maxWidth: 520,
  });

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

  // Keep level / super awakening valid for the card in each slot.
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
        if (next.selectedSuperAwakening != null && !options.includes(next.selectedSuperAwakening)) {
          changed = true;
          return { ...next, selectedSuperAwakening: null };
        }
        return next;
      });
      return changed ? { ...c, members } : c;
    });
  }, [monstersById, setConfig]);

  // One dungeon list for the picker and the trial: catalog + imported floor tables.
  const dungeonSources = useDungeonEntries();
  const dungeon = useMemo(
    () => resolveDungeonModifiers(config, dungeonSources.entries),
    [config, dungeonSources.entries]
  );
  const trialSeed = useMemo(
    () => seedForEntry(dungeon.entry, dungeonSources.seedsByPostId),
    [dungeon.entry, dungeonSources.seedsByPostId]
  );
  const trialMaxHit = useMemo(
    () => maxHitForEntry(dungeon.entry, dungeonSources.seedsByPostId),
    [dungeon.entry, dungeonSources.seedsByPostId]
  );
  const dungeonChips = useMemo(
    () =>
      describeDungeonModifiers(dungeon.stat, {
        sun: dungeon.dungeonAwks.includes(128),
        moon: dungeon.dungeonAwks.includes(129),
        multiplayer: dungeon.dungeonAwks.includes(30),
        maxFloor: dungeon.entry?.maxFloor ?? null,
        conditional: dungeon.conditional,
      }),
    [dungeon]
  );
  // With a usable floor table, broken parts are chosen per floor (Trial) and the team
  // totals use every part broken over the dungeon; otherwise the Team settings counter.
  const floorTable = useMemo(() => trialSeed?.floorSummary ?? [], [trialSeed]);
  const floorMode = hasUsableFloorTable(floorTable);
  const [floorPartsState, setFloorPartsState] = useState<{
    postId: number;
    parts: Map<number, number>;
  } | null>(null);
  const floorParts = useMemo(
    () =>
      trialSeed && floorPartsState?.postId === trialSeed.appmediaPostId
        ? floorPartsState.parts
        : defaultPartsBroken(floorTable),
    [trialSeed, floorPartsState, floorTable]
  );
  const setFloorParts = useCallback(
    (parts: Map<number, number>) => {
      if (trialSeed) setFloorPartsState({ postId: trialSeed.appmediaPostId, parts });
    },
    [trialSeed]
  );
  // Same cap as the multiplier, so the summary shows the count actually applied.
  const floorPartsTotal = floorMode
    ? clampPartsBroken(totalPartsBroken(floorTable, floorParts))
    : 0;
  /** Config the totals use: Part Break count from the floor table when it drives it. */
  const statsConfig = useMemo(
    () => (floorMode ? { ...config, partsBroken: floorPartsTotal } : config),
    [config, floorMode, floorPartsTotal]
  );
  const summary = useMemo(
    () => computeTeamStats(statsConfig, monstersById, dungeon),
    [statsConfig, monstersById, dungeon]
  );
  /** Team HP at a floor state (Aging by floor, cumulative broken parts) for the Trial. */
  const trialHpAt = useCallback(
    (state: FloorState) => teamHpAtState(config, monstersById, dungeon, state),
    [config, monstersById, dungeon]
  );
  /** Slots carrying Part Break Bonus (131): the parts control only shows when there is one. */
  const partBreakSlots = summary.members.filter(
    (m) =>
      m.monster != null &&
      partBreakCopiesForSlot(m.monster, m.eq, m.config.selectedSuperAwakening) > 0
  ).length;
  const partsBroken = config.partsBroken ?? 0;
  const dungeonActiveLabel =
    config.dungeonId && config.dungeonId !== "none" ? dungeon.label : null;

  const resultBySlot = useMemo(() => {
    const map = new Map<number, MemberStatResult>();
    for (const m of summary.members) map.set(m.slotIndex, m);
    return map;
  }, [summary.members]);

  const updateMember = useCallback(
    (index: number, next: TeamMemberConfig) => {
      setConfig((c) => ({
        ...c,
        members: c.members.map((m, i) => (i === index ? next : m)),
      }));
    },
    [setConfig]
  );

  const clearSelection = useCallback(() => {
    setSelectedSlot(null);
    qs.clearTarget();
  }, [qs]);

  /**
   * Select a slot and point the quick search at its Monster ID. Desktop opens
   * the sidebar; on mobile the drawer would cover the page, so only the
   * target is set (the edge tab / search button opens it). Clicking the
   * selected slot again clears the selection (team view).
   */
  const selectSlot = useCallback(
    (index: number) => {
      if (selectedSlot === index) {
        clearSelection();
        return;
      }
      setSelectedSlot(index);
      (isMobile ? qs.select : qs.activate)({
        key: `slot-${index}-monster`,
        label: `${slotLabel(index)} · Monster ID`,
        onPick: (id) =>
          setConfig((c) => ({
            ...c,
            members: c.members.map((m, i) =>
              i === index
                ? { ...m, monsterId: String(id), selectedSuperAwakening: null }
                : m
            ),
          })),
      });
    },
    [qs, setConfig, isMobile, selectedSlot, clearSelection]
  );

  const pickAssistFor = useCallback(
    (index: number) => {
      qs.activate({
        key: `slot-${index}-assist`,
        label: `${slotLabel(index)} · Eq ID`,
        onPick: (id) =>
          setConfig((c) => ({
            ...c,
            members: c.members.map((m, i) => (i === index ? { ...m, eqId: String(id) } : m)),
          })),
      });
    },
    [qs, setConfig]
  );

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
    const { members, warnings } = importTeamIdString(importText, config.members);
    setConfig((c) => ({ ...c, members }));
    setImportMsg(warnings.length ? warnings.join(" ") : "Team imported.");
    setImportText("");
    setTimeout(() => setImportMsg(null), 4000);
  };

  const showActionMsg = (message: string) => {
    setActionMsg(message);
    setTimeout(() => setActionMsg(null), 6000);
  };
  const transformable = useMemo(
    () => transformableSlots(config.members, monstersById),
    [config.members, monstersById]
  );
  const detransformable = useMemo(
    () => detransformableSlots(config.members, monstersById),
    [config.members, monstersById]
  );

  const handleScreenshotApply = (members: TeamMemberConfig[]) => {
    setConfig((c) => ({ ...c, members }));
    setScreenshotOpen(false);
    // The message and the imported id lines live in the Team IDs section: open it.
    setIdsOpen(true);
    setImportMsg("Team imported from screenshot.");
    setTimeout(() => setImportMsg(null), 4000);
  };

  const exportedMonsters = exportTeamIdString(config);
  const exportedEquipment = exportTeamEqString(config);
  const exportedTsubaki = exportTeamTsubakiString(config);

  const monsterOf = useCallback(
    (raw: string): MonsterRecord | null => {
      const id = parseId(raw);
      return id ? monstersById.get(id) ?? null : null;
    },
    [monstersById]
  );

  const selectedMember = selectedSlot != null ? config.members[selectedSlot] : null;
  const selectedMonster = selectedMember ? monsterOf(selectedMember.monsterId) : null;
  const selectedEq = selectedMember ? monsterOf(selectedMember.eqId) : null;
  const selectedResult = selectedSlot != null ? resultBySlot.get(selectedSlot) : undefined;

  const teamAwakeningSlots = useMemo(
    () =>
      config.members.map((m) => ({
        member: m,
        monster: monsterOf(m.monsterId),
        eq: monsterOf(m.eqId),
      })),
    [config.members, monsterOf]
  );

  const contributions = useMemo(() => {
    if (!selectedMonster || !selectedMember) return [];
    const leaders = config.members.filter((m) => m.role === "leader");
    const leaderRow = (i: number) => {
      const id = leaders[i] ? parseId(leaders[i].monsterId) : null;
      return id ? monstersById.get(id) ?? null : null;
    };
    const leaderMult = combineLeaderMultipliers(
      leaderMultipliersForMember(selectedMonster, leaderRow(0), config.leaderOverrides[0]),
      leaderMultipliersForMember(selectedMonster, leaderRow(1), config.leaderOverrides[1])
    );
    const teamAwakenings = config.members.flatMap((m) => {
      const row = parseId(m.monsterId) ? monstersById.get(parseId(m.monsterId)!) : null;
      if (!row) return [];
      const eq = parseId(m.eqId) ? monstersById.get(parseId(m.eqId)!) ?? null : null;
      return [...parseRegularAwakenings(row.awakenings), ...grantedAssistAwakenings(eq)];
    });
    return describeSlotContributions({
      member: selectedMember,
      row: selectedMonster,
      eq: selectedEq,
      config: statsConfig,
      dungeon,
      teamAwakenings,
      leaderMult,
    });
  }, [selectedMonster, selectedEq, selectedMember, config, statsConfig, dungeon, monstersById]);

  const awakeningPanel =
    selectedSlot != null && selectedMember ? (
      <TeamAwakeningPanel
        slotLabel={slotLabel(selectedSlot)}
        member={selectedMember}
        monster={selectedMonster}
        eq={selectedEq}
        result={selectedResult}
        contributions={contributions}
        onChangeMember={(next) => updateMember(selectedSlot, next)}
        onClearSelection={clearSelection}
        inline={isMobile}
      />
    ) : (
      <TeamAwakeningSummary slots={teamAwakeningSlots} inline={isMobile} />
    );

  return (
    <div className="flex h-full flex-col bg-[var(--color-surface)] text-[var(--color-fg)]">
      <PageHeader
        title="Team Build"
        subtitle="Team stat calculator"
        maxWidthClass="max-w-5xl"
        actions={
          <>
            <button
              type="button"
              className="pressable min-h-9 rounded-lg px-2 text-[11px] font-semibold text-[var(--color-muted)] hover:bg-[var(--color-negative)]/10 hover:text-[var(--color-negative)]"
              onClick={() => {
                if (window.confirm("Clear all team slots?")) clearMembers();
              }}
            >
              Reset team
            </button>
            <button
              type="button"
              className={`ds-btn pressable min-h-9 px-3 text-xs font-semibold ${
                dungeon.entry || config.dungeonId === "custom"
                  ? "border-[var(--color-accent)]/60 text-[var(--color-accent-strong)]"
                  : ""
              }`}
              onClick={() => setDungeonOpen(true)}
            >
              Dungeon
            </button>
          </>
        }
      />

      <QuickSearchLayout>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-4">
            <div className="mx-auto max-w-5xl">
              {/* Team actions: fill the team from a screenshot, max every card, transform / de-transform */}
              <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className="ds-btn-primary pressable min-h-10 px-4 text-xs font-semibold"
                  onClick={() => setScreenshotOpen(true)}
                  title="Import the team from an Edit Team screenshot (choose, drop or paste an image)"
                >
                  From screenshot…
                </button>
                <button
                  type="button"
                  className="ds-btn pressable min-h-10 px-4 text-xs font-semibold"
                  onClick={() => {
                    const members = maxOutMembers(config.members, monstersById);
                    setConfig((c) => ({ ...c, members: maxOutMembers(c.members, monstersById) }));
                    const levels = members
                      .map((m) => (m.monsterId ? String(m.level) : "–"))
                      .join(" · ");
                    showActionMsg(`Max all: Lv ${levels}, +891 on every card, +297 on every assist.`);
                  }}
                  title="Every card to its max level (Lv.99 for transform forms) and +891; assists +297 (limit-break plus does not raise the assist bonus)"
                >
                  Max all
                </button>
                {transformable.length > 0 && (
                  <button
                    type="button"
                    className="ds-btn pressable min-h-10 px-4 text-xs font-semibold"
                    onClick={() => {
                      const slots = transformable.map((i) => slotLabel(i)).join(", ");
                      setConfig((c) => ({
                        ...c,
                        members: transformMembers(c.members, monstersById),
                      }));
                      showActionMsg(`Transformed ${slots} into their post-transform form.`);
                    }}
                    title={`Swap ${transformable.map((i) => slotLabel(i)).join(", ")} for the post-transform form (max Lv.99)`}
                  >
                    Transform ({transformable.length})
                  </button>
                )}
                {detransformable.length > 0 && (
                  <button
                    type="button"
                    className="ds-btn pressable min-h-10 px-4 text-xs font-semibold"
                    onClick={() => {
                      const slots = detransformable.map((i) => slotLabel(i)).join(", ");
                      setConfig((c) => ({
                        ...c,
                        members: detransformMembers(c.members, monstersById),
                      }));
                      showActionMsg(`De-transformed ${slots} back to their pre-transform form.`);
                    }}
                    title={`Swap ${detransformable.map((i) => slotLabel(i)).join(", ")} back to the pre-transform form`}
                  >
                    De-transform ({detransformable.length})
                  </button>
                )}
              </div>
              {actionMsg && (
                <p className="mb-2 text-center text-[10px] text-[var(--color-amber-text)]">
                  {actionMsg}
                </p>
              )}

              {/* Team row — PAD layout: Leader | 4 subs | Helper (scrolls horizontally on narrow screens) */}
              <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
                <div className="mx-auto flex w-max items-end gap-2">
                  <div className="shrink-0 rounded-2xl bg-[var(--color-accent)]/[0.06] p-1 ring-1 ring-[var(--color-accent)]/25">
                    <TeamSlotCard
                      index={0}
                      member={config.members[0]}
                      result={resultBySlot.get(0)}
                      selected={selectedSlot === 0}
                      onSelect={() => selectSlot(0)}
                      dungeonLabel={dungeonActiveLabel}
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
                        onSelect={() => selectSlot(i)}
                        dungeonLabel={dungeonActiveLabel}
                      />
                    ))}
                  </div>
                  <div className="shrink-0 rounded-2xl bg-[var(--color-accent)]/[0.06] p-1 ring-1 ring-[var(--color-accent)]/25">
                    <TeamSlotCard
                      index={5}
                      member={config.members[5]}
                      result={resultBySlot.get(5)}
                      selected={selectedSlot === 5}
                      onSelect={() => selectSlot(5)}
                      dungeonLabel={dungeonActiveLabel}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrialOpen((v) => !v)}
                    aria-pressed={trialOpen}
                    title="Trial — test this team against a dungeon"
                    className={`pressable flex w-11 shrink-0 flex-col items-center justify-center gap-1.5 self-stretch rounded-2xl border ${
                      trialOpen
                        ? "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)] shadow-[var(--shadow-glow)]"
                        : "border-white/[0.06] bg-[var(--color-panel)]/90 text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)] hover:text-[var(--color-accent-strong)]"
                    }`}
                  >
                    <span aria-hidden className="text-xl leading-none">
                      ⇒
                    </span>
                    <span className="ds-label rotate-180 [writing-mode:vertical-rl]">Trial</span>
                  </button>
                </div>
              </div>

              <p className="mb-3 text-center text-[10px] text-[var(--color-faint)]">
                Click a slot to edit it or pick a replacement from the quick search on the left.
                Slot stats include stat awakenings, assist, leader skill
                {dungeonActiveLabel ? " and the selected dungeon" : ""}; totals add the badge and
                Enhanced Team HP / RCV awakenings. The ⇒ button opens the trial: test the team
                against an imported dungeon.
              </p>

              <div className="mb-3 grid grid-cols-3 gap-2 sm:gap-3">
                <TeamTotalBox
                  label="Total HP"
                  value={summary.teamHp}
                  raw={summary.teamRawHp}
                  accent={STAT_TEXT.hp}
                />
                <TeamTotalBox
                  label="Total ATK"
                  value={summary.teamAtk}
                  raw={summary.teamRawAtk}
                  accent={STAT_TEXT.atk}
                />
                <TeamTotalBox
                  label="Total RCV"
                  value={summary.teamRcv}
                  raw={summary.teamRawRcv}
                  accent={STAT_TEXT.rcv}
                />
              </div>

              {trialOpen && (
                <TeamTrialPanel
                  config={config}
                  monstersById={monstersById}
                  teamHp={summary.teamHp}
                  hpAt={trialHpAt}
                  floorPartsBroken={floorParts}
                  onFloorPartsBrokenChange={setFloorParts}
                  slotLabel={slotLabel}
                  entry={dungeon.entry}
                  dungeonLabel={dungeon.label}
                  seed={trialSeed}
                  maxHit={trialMaxHit}
                  listStatus={dungeonSources.listStatus}
                  listError={dungeonSources.listError}
                  onOpenDungeon={() => setDungeonOpen(true)}
                  onClose={() => setTrialOpen(false)}
                />
              )}

              {/* Team-level settings: badge + dungeon in one bar */}
              <section className="ds-card mb-3 p-3">
                <h2 className="ds-label mb-2">Team settings</h2>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
                  <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs text-[var(--color-muted)]">Badge</span>
                    <select
                      value={config.badge}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, badge: e.target.value as TeamBadgeId }))
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
                  {partBreakSlots > 0 && floorMode && (
                    <div className="flex flex-col gap-1 text-sm">
                      <span className="text-xs text-[var(--color-muted)]">
                        Parts broken · {partBreakSlots} card{partBreakSlots === 1 ? "" : "s"} with Part Break Bonus
                      </span>
                      <p className="text-xs text-[var(--color-fg)]">
                        <span className="font-mono font-semibold tabular-nums text-[var(--color-fg-strong)]">
                          {floorPartsTotal}
                        </span>{" "}
                        {floorTable.some((f) => f.partCount)
                          ? "from the floor table — set per floor in Trial ⇒"
                          : "— this dungeon's floor table has no breakable parts"}
                      </p>
                    </div>
                  )}
                  {partBreakSlots > 0 && !floorMode && (
                    <div className="flex flex-col gap-1 text-sm">
                      <span
                        className="text-xs text-[var(--color-muted)]"
                        title="Part Break Bonus (awakening 131): ×1.2 per broken part per copy; copies add (×1.4 for two)"
                      >
                        Parts broken · {partBreakSlots} card{partBreakSlots === 1 ? "" : "s"} with Part Break Bonus
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="One part fewer"
                          disabled={partsBroken <= 0}
                          onClick={() =>
                            setConfig((c) => ({
                              ...c,
                              partsBroken: clampPartsBroken((c.partsBroken ?? 0) - 1),
                            }))
                          }
                          className="ds-btn pressable h-8 w-8 text-sm disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="min-w-8 text-center font-mono text-sm font-semibold tabular-nums text-[var(--color-fg-strong)]">
                          {partsBroken}
                        </span>
                        <button
                          type="button"
                          aria-label="One part more"
                          disabled={partsBroken >= MAX_PARTS_BROKEN}
                          onClick={() =>
                            setConfig((c) => ({
                              ...c,
                              partsBroken: clampPartsBroken((c.partsBroken ?? 0) + 1),
                            }))
                          }
                          className="ds-btn pressable h-8 w-8 text-sm disabled:opacity-40"
                        >
                          +
                        </button>
                        <span className="text-[10px] text-[var(--color-muted)]">
                          ×1.2 per part per copy
                        </span>
                      </div>
                    </div>
                  )}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1 text-sm">
                    <span className="text-xs text-[var(--color-muted)]">Dungeon</span>
                    <button
                      type="button"
                      onClick={() => setDungeonOpen(true)}
                      className="ds-input pressable flex min-h-9 items-center justify-between gap-2 px-2 py-1 text-left text-xs"
                    >
                      <span className="truncate font-semibold text-[var(--color-fg-strong)]">
                        {dungeon.label}
                      </span>
                      <span aria-hidden className="text-[var(--color-muted)]">
                        ▾
                      </span>
                    </button>
                    {(dungeonChips.length > 0 || config.awkSettings.enabled.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1">
                        {dungeonChips.map((c) => (
                          <span
                            key={c}
                            className="rounded-full border border-[var(--color-border)] bg-[var(--color-inset)] px-1.5 py-px font-mono text-[9px] font-semibold text-[var(--color-fg)]"
                          >
                            {c}
                          </span>
                        ))}
                        {config.awkSettings.enabled.length > 0 && (
                          <span className="text-[10px] text-[var(--color-muted)]">
                            + {config.awkSettings.enabled.length} manual awakening
                            {config.awkSettings.enabled.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Team IDs — collapsed by default */}
              <section className="ds-card mb-4 p-3">
                <button
                  type="button"
                  onClick={() => setIdsOpen((v) => !v)}
                  aria-expanded={idsOpen}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span
                    aria-hidden
                    className={`text-xs text-[var(--color-accent)] transition-transform ${idsOpen ? "" : "-rotate-90"}`}
                  >
                    ▾
                  </span>
                  <h2 className="ds-label">Team IDs · import / export</h2>
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] tabular-nums text-[var(--color-faint)]">
                    {exportedMonsters}
                  </span>
                  {copyMsg && (
                    <span className="shrink-0 text-[10px] font-semibold text-[var(--color-positive)]">
                      {copyMsg}
                    </span>
                  )}
                </button>
                {idsOpen && (
                  <div className="mt-3 space-y-3">
                    <CopyRow
                      label="Monsters"
                      value={exportedMonsters}
                      accent="text-[var(--color-accent-strong)]"
                      onCopy={() => copyToClipboard(exportedMonsters, "Monsters")}
                    />
                    <CopyRow
                      label="Equipment"
                      value={exportedEquipment}
                      accent="text-emerald-300"
                      onCopy={() => copyToClipboard(exportedEquipment, "Equipment")}
                    />
                    <CopyRow
                      label="Tsubaki"
                      value={exportedTsubaki}
                      accent="text-[var(--color-secondary-strong)]"
                      buttonLabel="Copy for Tsubaki"
                      onCopy={() => copyToClipboard(exportedTsubaki, "Tsubaki")}
                    />
                    <p className="text-[10px] text-[var(--color-muted)]">
                      Order: leader · 4 subs · helper. Empty slot ={" "}
                      <code className="font-mono font-bold text-[var(--color-accent-strong)]">1</code>.
                      Import: line 1 monsters, line 2 equipment.
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
                      <p className="text-[10px] text-[var(--color-amber-text)]">{importMsg}</p>
                    )}
                  </div>
                )}
              </section>

              {/* Selected slot: card sheet beside its settings once the column is wide enough
                  (container query, so the layout follows the space left by the side panels) */}
              {selectedSlot == null || !selectedMember ? (
                <div className="ds-card p-4 text-center text-xs text-[var(--color-muted)]">
                  No slot selected — the panel shows the whole team's awakenings. Click a slot to
                  see its card and settings.
                  {isMobile && <div className="mt-3 text-left">{awakeningPanel}</div>}
                </div>
              ) : (
              <div className="@container">
                <div className="grid gap-4 @xl:grid-cols-[minmax(280px,380px)_minmax(240px,1fr)] @xl:items-start">
                  <div className="min-w-0">
                    {selectedMonster ? (
                      <TeamCardSheet
                        slotLabel={slotLabel(selectedSlot)}
                        member={selectedMember}
                        monster={selectedMonster}
                        eq={selectedEq}
                        result={selectedResult}
                        onPickAssist={() => pickAssistFor(selectedSlot)}
                      />
                    ) : (
                      <div className="ds-card p-4 text-center text-xs text-[var(--color-muted)]">
                        {slotLabel(selectedSlot)} is empty — pick a card from the quick search or
                        type an ID in the slot settings.
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-3">
                    <SlotEditor
                      index={selectedSlot}
                      member={selectedMember}
                      monster={selectedMonster}
                      onChange={(next) => updateMember(selectedSlot, next)}
                    />
                    {isMobile && <div className="ds-card p-3">{awakeningPanel}</div>}
                  </div>
                </div>
              </div>
              )}
            </div>
          </div>

          {!isMobile && (
            <ResizableSidePanel
              side="right"
              collapsed={awkPanel.collapsed}
              width={awkPanel.width}
              dragHandleProps={awkPanel.dragHandleProps}
              collapsedLabel="Awakenings"
              onExpandToggle={awkPanel.toggleCollapsed}
              ariaLabel="awakenings and stat bonuses"
            >
              <div className="flex h-full min-w-0 flex-col overflow-hidden">
                <div className="glass-bar flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
                  <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[var(--color-fg-strong)]">
                    <span
                      aria-hidden
                      className="h-3.5 w-1 rounded-full bg-[var(--color-positive)] shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                    />
                    Awakenings
                  </h2>
                  <button
                    type="button"
                    onClick={awkPanel.toggleCollapsed}
                    title="Collapse awakenings"
                    aria-label="Collapse awakenings"
                    className="pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white/5 text-[var(--color-muted)] hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-accent-muted)] hover:text-[var(--color-accent-strong)]"
                  >
                    <span aria-hidden className="text-sm leading-none">
                      ›
                    </span>
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">{awakeningPanel}</div>
              </div>
            </ResizableSidePanel>
          )}
        </div>
      </QuickSearchLayout>

      <DungeonPickerModal
        open={dungeonOpen && !awkOpen}
        config={config}
        entries={dungeonSources.entries}
        seedsByPostId={dungeonSources.seedsByPostId}
        onChange={(next) => setConfig(next)}
        onClose={() => setDungeonOpen(false)}
        onOpenAdvanced={() => setAwkOpen(true)}
      />
      <AwkModifierModal
        open={awkOpen}
        stat="hp"
        settings={config.awkSettings}
        hiddenIds={HIDDEN_MANUAL_AWAKENING_IDS}
        onChange={(awkSettings) => setConfig((c) => ({ ...c, awkSettings }))}
        onClose={() => setAwkOpen(false)}
      />
      <ScreenshotImportModal
        open={screenshotOpen}
        members={config.members}
        onApply={handleScreenshotApply}
        onClose={() => setScreenshotOpen(false)}
      />
    </div>
  );
}
