import {
  DEFAULT_AWK_MODIFIER_SETTINGS,
  type AwkModifierSettings,
} from "../awakening-stat-modifier.ts";
import { clampPartsBroken, PART_BREAK_AWAKENING_ID } from "../part-break.ts";
import { BADGE_TEAM_PCT } from "./stat-reference.ts";
import {
  DEFAULT_CUSTOM_DUNGEON,
  defaultTeamBuildConfig,
  emptyMember,
  TEAM_SIZE,
  type CustomDungeonModifiers,
  type MonsterLevelTarget,
  type TeamBadgeId,
  type TeamBuildConfig,
  type TeamMemberConfig,
} from "./types.ts";

/**
 * Team build draft shared between the search page (slot picker / mini preview)
 * and the team build page. Pages are full reloads, so localStorage is the only
 * channel between them.
 */
export const TEAM_DRAFT_STORAGE_KEY = "pst.team-build.draft.v1";

export type TeamDraftSlotKind = "monster" | "assist";

/** Minimal storage surface so the module can be unit-tested without a DOM. */
export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type Raw = Record<string, unknown>;

function isObject(v: unknown): v is Raw {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function idString(v: unknown): string {
  if (typeof v === "number" && Number.isInteger(v) && v > 0) return String(v);
  if (typeof v === "string" && /^\d{1,7}$/.test(v.trim())) {
    return String(Number(v.trim()));
  }
  return "";
}

function int(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function level(v: unknown, fallback: MonsterLevelTarget): MonsterLevelTarget {
  return v === 99 || v === 110 || v === 120 ? v : fallback;
}

function sanitizeMember(raw: unknown, fallback: TeamMemberConfig): TeamMemberConfig {
  if (!isObject(raw)) return fallback;
  const sa = raw.selectedSuperAwakening;
  return {
    role: fallback.role,
    monsterId: idString(raw.monsterId),
    eqId: idString(raw.eqId),
    plusHp: int(raw.plusHp, fallback.plusHp, 0, 297),
    plusAtk: int(raw.plusAtk, fallback.plusAtk, 0, 297),
    plusRcv: int(raw.plusRcv, fallback.plusRcv, 0, 297),
    eqPlusHp: int(raw.eqPlusHp, fallback.eqPlusHp, 0, 297),
    eqPlusRcv: int(raw.eqPlusRcv, fallback.eqPlusRcv, 0, 297),
    eqPlusAtk: int(raw.eqPlusAtk, fallback.eqPlusAtk ?? 0, 0, 297),
    level: level(raw.level, fallback.level),
    selectedSuperAwakening:
      typeof sa === "number" && Number.isInteger(sa) && sa > 0 ? sa : null,
  };
}

function sanitizeAwkSettings(raw: unknown): AwkModifierSettings {
  const d = DEFAULT_AWK_MODIFIER_SETTINGS;
  if (!isObject(raw)) return { ...d, enabled: [] };
  const enabled = Array.isArray(raw.enabled)
    ? raw.enabled.filter(
        (x): x is number => typeof x === "number" && Number.isInteger(x) && x > 0
      )
    : [];
  return {
    enabled: [...new Set(enabled)],
    yinYang: raw.yinYang === 128 || raw.yinYang === 129 ? raw.yinYang : null,
    selfOrAssist:
      raw.selfOrAssist === 138 || raw.selfOrAssist === 139
        ? raw.selfOrAssist
        : null,
    agingBattle: raw.agingBattle === 5 ? 5 : 10,
    combo43: raw.combo43 === 7 ? 7 : 14,
    atk57or58: raw.atk57or58 === 57 || raw.atk57or58 === 58 ? raw.atk57or58 : null,
    battle143:
      raw.battle143 === 3 ||
      raw.battle143 === 6 ||
      raw.battle143 === 9 ||
      raw.battle143 === 12
        ? raw.battle143
        : 15,
    parts131: int(raw.parts131, d.parts131, 0, 10),
  };
}

function sanitizeCustomDungeon(raw: unknown): CustomDungeonModifiers {
  const d = DEFAULT_CUSTOM_DUNGEON;
  if (!isObject(raw)) return { ...d };
  return {
    hp: num(raw.hp, d.hp, 0, 100),
    atk: num(raw.atk, d.atk, 0, 100),
    rcv: num(raw.rcv, d.rcv, 0, 100),
    sun: raw.sun === true,
    moon: raw.moon === true,
  };
}

function sanitizeOverride(raw: unknown): { hp: number; rcv: number } {
  if (!isObject(raw)) return { hp: 1, rcv: 1 };
  return { hp: num(raw.hp, 1, 0, 1000), rcv: num(raw.rcv, 1, 0, 1000) };
}

/** Coerce any parsed JSON into a valid config; unknown input yields the default team. */
export function sanitizeTeamBuildConfig(raw: unknown): TeamBuildConfig {
  const base = defaultTeamBuildConfig();
  if (!isObject(raw)) return base;

  const rawMembers = Array.isArray(raw.members) ? raw.members : [];
  const members = base.members.map((fallback, i) =>
    sanitizeMember(rawMembers[i], fallback)
  );

  const badge =
    typeof raw.badge === "string" && Object.hasOwn(BADGE_TEAM_PCT, raw.badge)
      ? (raw.badge as TeamBadgeId)
      : base.badge;

  const rawOverrides = Array.isArray(raw.leaderOverrides) ? raw.leaderOverrides : [];

  return {
    members,
    badge,
    awkSettings: sanitizeAwkSettings(raw.awkSettings),
    leaderOverrides: [
      sanitizeOverride(rawOverrides[0]),
      sanitizeOverride(rawOverrides[1]),
    ],
    dungeonId:
      typeof raw.dungeonId === "string" && /^[\w-]{1,64}$/.test(raw.dungeonId)
        ? raw.dungeonId
        : base.dungeonId,
    customDungeon: sanitizeCustomDungeon(raw.customDungeon),
    partsBroken: sanitizePartsBroken(raw),
  };
}

/**
 * Drafts saved before `partsBroken` existed kept the count in the manual awakening
 * settings (`parts131`, only meaningful while 131 was enabled there).
 */
function sanitizePartsBroken(raw: Raw): number {
  if (raw.partsBroken !== undefined) return clampPartsBroken(Number(raw.partsBroken));
  const awk = isObject(raw.awkSettings) ? raw.awkSettings : null;
  const enabled = awk && Array.isArray(awk.enabled) ? awk.enabled : [];
  if (!enabled.includes(PART_BREAK_AWAKENING_ID)) return 0;
  return clampPartsBroken(Number(awk?.parts131));
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadTeamDraft(
  storage: StorageLike | null = defaultStorage()
): TeamBuildConfig | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(TEAM_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeTeamBuildConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveTeamDraft(
  config: TeamBuildConfig,
  storage: StorageLike | null = defaultStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(TEAM_DRAFT_STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function clearTeamDraft(
  storage: StorageLike | null = defaultStorage()
): void {
  try {
    storage?.removeItem(TEAM_DRAFT_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Put `monsterId` (or nothing when null) into one slot; other fields are preserved. */
export function setDraftSlot(
  config: TeamBuildConfig,
  slotIndex: number,
  kind: TeamDraftSlotKind,
  monsterId: number | null
): TeamBuildConfig {
  if (slotIndex < 0 || slotIndex >= TEAM_SIZE) return config;
  const value =
    monsterId != null && Number.isInteger(monsterId) && monsterId > 0
      ? String(monsterId)
      : "";
  const members = config.members.map((m, i) => {
    if (i !== slotIndex) return m;
    if (kind === "assist") return { ...m, eqId: value };
    return { ...m, monsterId: value, selectedSuperAwakening: null };
  });
  return { ...config, members };
}

export function draftHasCards(config: TeamBuildConfig): boolean {
  return config.members.some((m) => m.monsterId !== "" || m.eqId !== "");
}

/** Members reset to empty slots; team-level settings (badge, dungeon, awk) are kept. */
export function clearDraftMembers(config: TeamBuildConfig): TeamBuildConfig {
  return {
    ...config,
    members: config.members.map((m) => emptyMember(m.role)),
  };
}

/** Fires when another tab / page writes the draft. Returns the unsubscribe function. */
export function subscribeTeamDraft(
  onChange: (next: TeamBuildConfig | null) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key !== null && e.key !== TEAM_DRAFT_STORAGE_KEY) return;
    onChange(loadTeamDraft());
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
