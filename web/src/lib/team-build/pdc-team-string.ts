import type { MonsterRecord } from "../../types.ts";
import { maxMonsterLevel } from "./level-scaling.ts";
import type { TeamBadgeId, TeamBuildConfig, TeamMemberConfig } from "./types.ts";
import { TEAM_SIZE, emptyMember } from "./types.ts";

/**
 * Codec for the team QR code of PDC (パズドラダメージ計算).
 *
 * The QR holds plain text, not encrypted data. Layout (reverse-engineered from eleven
 * real QR codes on 2026-11-09, no public spec exists):
 *
 *   <header>]<badge>}<member>}<member>...
 *
 * - `header`: `1,0` in every sample; meaning unknown. Kept verbatim.
 * - The team title and memo are NOT in the QR: PDC only draws them on the image
 *   (sample 11 has both filled in and its text is still `1,0]1}...`).
 * - `badge`: PDC's own badge token (see `PDC_BADGE_TO_PST`).
 * - `member`: comma-separated entries `<2-char key><value>`; values are base-36
 *   (`-1` allowed).
 *   Checked against seed/dadguide.sqlite (all 60 members of samples 1–10):
 *     00 monster id   01 transform chain root (`transform_root_id`; transform cards only)
 *     08 selected super awakening (dadguide awakening id, 0 = none)
 *     0g sync awakening id (present exactly when the card has `sync_awsid`)
 *     09 assist id    0a assist level (dadguide `level`: 99, or 1 for most equips)
 *   Read off the screenshots:
 *     02 latents (2 base-36 chars each, PDC's own latent ids — NOT dadguide ids)
 *     03 level        04/05/06 +HP/+ATK/+RCV per stat (0–297)
 *     0b/0c/0d assist +HP/+ATK/+RCV   0f slot index 0–5 (5 = friend leader)
 *   Unknown: 07 and 0e (-1 in every sample).
 * - An empty slot has no member at all; a card without an assist has no 09–0e keys
 *   (both seen in sample 11).
 */

export const PDC_KEY = {
  monsterId: "00",
  transformBaseId: "01",
  latents: "02",
  level: "03",
  plusHp: "04",
  plusAtk: "05",
  plusRcv: "06",
  unknown07: "07",
  superAwakening: "08",
  syncAwakening: "0g",
  assistId: "09",
  assistLevel: "0a",
  assistPlusHp: "0b",
  assistPlusAtk: "0c",
  assistPlusRcv: "0d",
  unknown0e: "0e",
  slot: "0f",
} as const;

/** Key order PDC writes (0g sits after 08 in every sample). */
export const PDC_CANONICAL_KEY_ORDER: readonly string[] = [
  "00", "01", "02", "03", "04", "05", "06", "07", "08", "0g", "09", "0a", "0b", "0c", "0d", "0e", "0f",
];

const ASSIST_DETAIL_KEYS = ["0a", "0b", "0c", "0d", "0e"];
const KNOWN_KEYS = new Set(PDC_CANONICAL_KEY_ORDER);

/** Assist level PDC writes when nothing better is known (normal assists). */
const DEFAULT_ASSIST_LEVEL = 99;

export type PdcMember = {
  slot: number;
  monsterId: number;
  /** Root of the transform chain (key 01); null when PDC omits it. */
  transformBaseId: number | null;
  /** PDC latent ids, in PDC's order. Not mapped to dadguide latent ids. */
  latents: number[];
  level: number;
  plusHp: number;
  plusAtk: number;
  plusRcv: number;
  unknown07: number;
  /** 0 = no super awakening selected. */
  superAwakening: number;
  syncAwakening: number | null;
  assist: {
    id: number;
    level: number;
    plusHp: number;
    plusAtk: number;
    plusRcv: number;
    unknown0e: number;
  } | null;
  /**
   * Entries this codec does not interpret (unknown keys, or assist details without an
   * assist id), kept verbatim for a lossless round trip.
   */
  extraEntries: Record<string, string>;
  /** Key order as parsed; serialization falls back to the canonical order. */
  keyOrder?: string[];
};

export type PdcTeam = {
  /** Text before `]` (`1,0` in all samples). */
  header: string;
  /** Raw badge token between `]` and the first `}`. */
  badge: string;
  members: PdcMember[];
};

export class PdcTeamStringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdcTeamStringError";
  }
}

const BASE36_VALUE = /^-?[0-9a-z]+$/;

function decodeNumber(raw: string, key: string): number {
  if (!BASE36_VALUE.test(raw)) {
    throw new PdcTeamStringError(`Invalid base-36 value "${raw}" for key ${key}.`);
  }
  const negative = raw.startsWith("-");
  const n = parseInt(negative ? raw.slice(1) : raw, 36);
  const value = negative ? -n : n;
  if (!Number.isSafeInteger(value)) {
    throw new PdcTeamStringError(`Value "${raw}" for key ${key} is out of range.`);
  }
  return value;
}

function encodeNumber(n: number): string {
  if (!Number.isSafeInteger(n)) {
    throw new PdcTeamStringError(`Cannot encode value ${n}.`);
  }
  return n < 0 ? `-${(-n).toString(36)}` : n.toString(36);
}

function decodeLatents(raw: string): number[] {
  if (raw.length % 2 !== 0 || !/^[0-9a-z]*$/.test(raw)) {
    throw new PdcTeamStringError(`Invalid latent list "${raw}".`);
  }
  const out: number[] = [];
  for (let i = 0; i < raw.length; i += 2) out.push(parseInt(raw.slice(i, i + 2), 36));
  return out;
}

function encodeLatents(latents: number[]): string {
  return latents
    .map((id) => {
      if (!Number.isInteger(id) || id < 0 || id >= 36 * 36) {
        throw new PdcTeamStringError(`Latent id ${id} does not fit in two base-36 chars.`);
      }
      return id.toString(36).padStart(2, "0");
    })
    .join("");
}

function parseMember(chunk: string): PdcMember {
  const raw: Record<string, string> = {};
  const keyOrder: string[] = [];
  for (const entry of chunk.split(",")) {
    if (entry.length < 2) throw new PdcTeamStringError(`Invalid member entry "${entry}".`);
    const key = entry.slice(0, 2);
    if (Object.hasOwn(raw, key)) throw new PdcTeamStringError(`Duplicate key ${key} in member.`);
    raw[key] = entry.slice(2);
    keyOrder.push(key);
  }
  const has = (key: string) => Object.hasOwn(raw, key);
  const num = (key: string): number => {
    if (!has(key)) throw new PdcTeamStringError(`Member is missing key ${key}.`);
    return decodeNumber(raw[key], key);
  };
  const optNum = (key: string, fallback: number): number =>
    has(key) ? decodeNumber(raw[key], key) : fallback;

  const hasAssist = has(PDC_KEY.assistId);
  const extraEntries: Record<string, string> = {};
  for (const key of keyOrder) {
    const uninterpreted = !KNOWN_KEYS.has(key) || (!hasAssist && ASSIST_DETAIL_KEYS.includes(key));
    if (uninterpreted) extraEntries[key] = raw[key];
  }

  const slot = num(PDC_KEY.slot);
  if (slot < 0 || slot >= TEAM_SIZE) throw new PdcTeamStringError(`Slot ${slot} is out of range.`);

  return {
    slot,
    monsterId: num(PDC_KEY.monsterId),
    transformBaseId: has(PDC_KEY.transformBaseId) ? num(PDC_KEY.transformBaseId) : null,
    latents: has(PDC_KEY.latents) ? decodeLatents(raw[PDC_KEY.latents]) : [],
    level: num(PDC_KEY.level),
    plusHp: optNum(PDC_KEY.plusHp, 0),
    plusAtk: optNum(PDC_KEY.plusAtk, 0),
    plusRcv: optNum(PDC_KEY.plusRcv, 0),
    unknown07: optNum(PDC_KEY.unknown07, -1),
    superAwakening: optNum(PDC_KEY.superAwakening, 0),
    syncAwakening: has(PDC_KEY.syncAwakening) ? num(PDC_KEY.syncAwakening) : null,
    assist: hasAssist
      ? {
          id: num(PDC_KEY.assistId),
          level: optNum(PDC_KEY.assistLevel, DEFAULT_ASSIST_LEVEL),
          plusHp: optNum(PDC_KEY.assistPlusHp, 0),
          plusAtk: optNum(PDC_KEY.assistPlusAtk, 0),
          plusRcv: optNum(PDC_KEY.assistPlusRcv, 0),
          unknown0e: optNum(PDC_KEY.unknown0e, -1),
        }
      : null,
    extraEntries,
    keyOrder,
  };
}

/**
 * Parses the text read from a PDC team QR code. Throws `PdcTeamStringError` when the
 * text is not a PDC team (no `]`, no card, malformed entry).
 */
export function parsePdcTeamString(text: string): PdcTeam {
  const trimmed = text.trim();
  const bracket = trimmed.indexOf("]");
  if (bracket < 0) throw new PdcTeamStringError("Not a PDC team string: missing ']'.");
  const header = trimmed.slice(0, bracket);
  const [badge, ...chunks] = trimmed.slice(bracket + 1).split("}");
  const members = chunks.filter((c) => c.length > 0).map(parseMember);
  if (members.length === 0) throw new PdcTeamStringError("Not a PDC team string: no cards.");
  const slots = new Set<number>();
  for (const m of members) {
    if (slots.has(m.slot)) throw new PdcTeamStringError(`Slot ${m.slot} appears twice.`);
    slots.add(m.slot);
  }
  return { header, badge, members };
}

function memberEntries(m: PdcMember): Map<string, string> {
  const e = new Map<string, string>();
  e.set(PDC_KEY.monsterId, encodeNumber(m.monsterId));
  if (m.transformBaseId != null) e.set(PDC_KEY.transformBaseId, encodeNumber(m.transformBaseId));
  if (m.latents.length > 0) e.set(PDC_KEY.latents, encodeLatents(m.latents));
  e.set(PDC_KEY.level, encodeNumber(m.level));
  e.set(PDC_KEY.plusHp, encodeNumber(m.plusHp));
  e.set(PDC_KEY.plusAtk, encodeNumber(m.plusAtk));
  e.set(PDC_KEY.plusRcv, encodeNumber(m.plusRcv));
  e.set(PDC_KEY.unknown07, encodeNumber(m.unknown07));
  e.set(PDC_KEY.superAwakening, encodeNumber(m.superAwakening));
  if (m.syncAwakening != null) e.set(PDC_KEY.syncAwakening, encodeNumber(m.syncAwakening));
  if (m.assist) {
    e.set(PDC_KEY.assistId, encodeNumber(m.assist.id));
    e.set(PDC_KEY.assistLevel, encodeNumber(m.assist.level));
    e.set(PDC_KEY.assistPlusHp, encodeNumber(m.assist.plusHp));
    e.set(PDC_KEY.assistPlusAtk, encodeNumber(m.assist.plusAtk));
    e.set(PDC_KEY.assistPlusRcv, encodeNumber(m.assist.plusRcv));
    e.set(PDC_KEY.unknown0e, encodeNumber(m.assist.unknown0e));
  }
  e.set(PDC_KEY.slot, encodeNumber(m.slot));
  for (const [k, v] of Object.entries(m.extraEntries)) if (!e.has(k)) e.set(k, v);
  return e;
}

function serializeMember(m: PdcMember): string {
  const entries = memberEntries(m);
  const parsedOrder = m.keyOrder;
  // Keep the parsed order only while it covers every key; otherwise a key added
  // after import (e.g. 01 from a lookup) would land at the end.
  const order =
    parsedOrder && [...entries.keys()].every((k) => parsedOrder.includes(k))
      ? parsedOrder
      : [...PDC_CANONICAL_KEY_ORDER, ...Object.keys(m.extraEntries)];
  return order
    .filter((k) => entries.has(k))
    .map((k) => `${k}${entries.get(k)}`)
    .join(",");
}

/** Builds the QR text PDC reads. Members are written in slot order. */
export function serializePdcTeamString(team: PdcTeam): string {
  const members = [...team.members].sort((a, b) => a.slot - b.slot);
  return `${team.header}]${team.badge}` + members.map((m) => `}${serializeMember(m)}`).join("");
}

// ---------------------------------------------------------------------------
// Badge mapping
// ---------------------------------------------------------------------------

/**
 * PDC badge token → PST badge. Only tokens whose badge is known are listed:
 * `1` HP +10% (sample 11, confirmed by the user), `2` HP +15% (same HP icon with the
 * bold "+" of the upgraded badge), `43` devil type (devil-face icon).
 * Seen but not mapped yet: `9` (「全」 icon), `77` (Digimon collab badge).
 */
export const PDC_BADGE_TO_PST: Readonly<Record<string, TeamBadgeId>> = {
  "1": "hp_10",
  "2": "hp_15",
  "43": "type_devil",
};

/** Header PDC writes in every sample; used for teams that never came from PDC. */
export const PDC_DEFAULT_HEADER = "1,0";

/** Token written when the PST badge has no PDC token. Unverified: no sample without a badge. */
export const PDC_FALLBACK_BADGE = "0";

export function pdcBadgeToPst(token: string): TeamBadgeId | null {
  return Object.hasOwn(PDC_BADGE_TO_PST, token) ? PDC_BADGE_TO_PST[token] : null;
}

export function pstBadgeToPdc(badge: TeamBadgeId): string | null {
  for (const [token, id] of Object.entries(PDC_BADGE_TO_PST)) if (id === badge) return token;
  return null;
}

// ---------------------------------------------------------------------------
// PDC → PST
// ---------------------------------------------------------------------------

export type PdcToPstResult = {
  config: TeamBuildConfig;
  /** Parsed PDC team; pass it back as `previous` to keep PDC-only data on export. */
  source: PdcTeam;
  warnings: string[];
};

function pstLevel(level: number): TeamMemberConfig["level"] {
  if (level >= 120) return 120;
  if (level >= 110) return 110;
  return 99;
}

function clampPlus(n: number): number {
  return Math.min(297, Math.max(0, n));
}

/** PST treats ids ≤ 1 as an empty slot (PAD team export writes `1` for one). */
function isCardId(id: number): boolean {
  return Number.isInteger(id) && id > 1;
}

/**
 * Converts a parsed PDC team into a PST team. Fields PST does not model (latents,
 * transform root, sync awakening, assist level, unknown keys) stay in `source`.
 * Settings PDC does not carry (awakening settings, dungeon, leader overrides) come
 * from `base`, which must hold the 6 team slots.
 */
export function pdcTeamToPst(team: PdcTeam, base: TeamBuildConfig): PdcToPstResult {
  const warnings: string[] = [];
  const bySlot = new Map(team.members.map((m) => [m.slot, m]));

  const members = base.members.map((baseMember, slot): TeamMemberConfig => {
    const role = baseMember.role;
    const m = bySlot.get(slot);
    if (!m) return emptyMember(role);
    if (!isCardId(m.monsterId)) {
      warnings.push(`Slot ${slot + 1}: card id ${m.monsterId} is not valid; slot left empty.`);
      return emptyMember(role);
    }
    const level = pstLevel(m.level);
    if (level !== m.level) {
      warnings.push(`Slot ${slot + 1}: PDC level ${m.level} imported as Lv ${level}.`);
    }
    const assist = m.assist && isCardId(m.assist.id) ? m.assist : null;
    if (m.assist && !assist) {
      warnings.push(`Slot ${slot + 1}: assist id ${m.assist.id} is not valid; assist dropped.`);
    }
    return {
      role,
      monsterId: String(m.monsterId),
      eqId: assist ? String(assist.id) : "",
      plusHp: clampPlus(m.plusHp),
      plusAtk: clampPlus(m.plusAtk),
      plusRcv: clampPlus(m.plusRcv),
      eqPlusHp: assist ? clampPlus(assist.plusHp) : baseMember.eqPlusHp,
      eqPlusAtk: assist ? clampPlus(assist.plusAtk) : baseMember.eqPlusAtk,
      eqPlusRcv: assist ? clampPlus(assist.plusRcv) : baseMember.eqPlusRcv,
      level,
      // PST applies the sync awakening automatically; only a chosen SA is stored.
      selectedSuperAwakening: m.superAwakening > 0 ? m.superAwakening : null,
    };
  });

  let badge = pdcBadgeToPst(team.badge);
  if (badge == null) {
    warnings.push(`PDC badge "${team.badge.slice(0, 8)}" has no PST mapping yet; badge set to none.`);
    badge = "none";
  }
  if (team.members.some((m) => m.latents.length > 0)) {
    warnings.push("Latent awakenings are not supported in PST and were not imported.");
  }
  if (team.header !== PDC_DEFAULT_HEADER || team.members.some((m) => Object.keys(m.extraEntries).length > 0)) {
    warnings.push("The QR has PDC fields PST does not know; they were not imported.");
  }

  return { config: { ...base, members, badge }, source: team, warnings };
}

export function pdcTeamStringToPst(text: string, base: TeamBuildConfig): PdcToPstResult {
  return pdcTeamToPst(parsePdcTeamString(text), base);
}

// ---------------------------------------------------------------------------
// PST → PDC
// ---------------------------------------------------------------------------

/** Card data PDC stores but PST does not (from the monster DB). */
export type PdcMonsterInfo = {
  /** Key 01 when the card is on a transform chain; null = not a transform card. */
  transformBaseId?: number | null;
  /** Key 0g; null = the card has no sync awakening. */
  syncAwakeningId?: number | null;
  /** Highest level the card reaches as a team member (99, or 110 / 120 with limit break). */
  maxLevel?: number;
  /** Level PDC writes when the card is an assist: dadguide `level` (99, or 1 for most equips). */
  assistLevel?: number;
};

/** `PdcMonsterInfo` from a `/monsters/lookup` row. */
export function pdcMonsterInfoFromRecord(row: MonsterRecord): PdcMonsterInfo {
  const sync = Number(row.sync_awsid);
  const root = Number(row.transform_root_id);
  const baseLevel = Number(row.level);
  return {
    transformBaseId: row.transform_root_id === undefined ? undefined : isCardId(root) ? root : null,
    syncAwakeningId: Number.isInteger(sync) && sync > 0 ? sync : null,
    maxLevel: maxMonsterLevel(row),
    assistLevel:
      Number.isInteger(baseLevel) && baseLevel > 0 ? Math.min(DEFAULT_ASSIST_LEVEL, baseLevel) : undefined,
  };
}

export type PstToPdcOptions = {
  /** Team returned by `pdcTeamToPst`; keeps latents, header, badge, assist level. */
  previous?: PdcTeam;
  /** Supplies keys 01 / 0g and the level caps for cards and assists. */
  lookup?: (monsterId: number) => PdcMonsterInfo | undefined;
};

export type PstToPdcResult = {
  team: PdcTeam;
  text: string;
  warnings: string[];
};

/** PST plus inputs can hold any number (e.g. 99.5 while typing); PDC needs 0–297 integers. */
function toPdcPlus(n: number | undefined): number {
  return Number.isFinite(n) ? clampPlus(Math.round(n as number)) : 0;
}

function toPdcLevel(n: number): number {
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 99;
}

function slotCardId(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d{1,7}$/.test(s)) return null;
  const n = Number(s);
  return isCardId(n) ? n : null;
}

function resolveBadge(config: TeamBuildConfig, previous: PdcTeam | undefined, warnings: string[]): string {
  if (previous) {
    const prevMapped = pdcBadgeToPst(previous.badge);
    if (prevMapped === config.badge || (prevMapped == null && config.badge === "none")) {
      return previous.badge;
    }
  }
  const token = pstBadgeToPdc(config.badge);
  if (token != null) return token;
  if (config.badge !== "none") {
    warnings.push(`Badge "${config.badge}" has no PDC mapping yet; the QR has no badge.`);
  }
  return PDC_FALLBACK_BADGE;
}

/** Converts a PST team into a PDC team and its QR text. Empty slots are omitted. */
export function pstTeamToPdc(config: TeamBuildConfig, options: PstToPdcOptions = {}): PstToPdcResult {
  const { previous, lookup } = options;
  const warnings: string[] = [];
  const prevBySlot = new Map((previous?.members ?? []).map((m) => [m.slot, m]));

  const members: PdcMember[] = [];
  config.members.forEach((member, slot) => {
    const monsterId = slotCardId(member.monsterId);
    if (monsterId == null) return;
    const prevSlot = prevBySlot.get(slot);
    const prev = prevSlot?.monsterId === monsterId ? prevSlot : undefined;
    const info = lookup?.(monsterId);

    const assistId = slotCardId(member.eqId);
    // Matched by slot, not by card: changing the card keeps the assist's PDC data.
    const prevAssist = assistId != null && prevSlot?.assist?.id === assistId ? prevSlot.assist : null;
    const assistInfo = assistId != null && !prevAssist ? lookup?.(assistId) : undefined;

    const transformBaseId =
      info?.transformBaseId !== undefined ? info.transformBaseId : (prev?.transformBaseId ?? null);
    const syncAwakening =
      info?.syncAwakeningId !== undefined ? info.syncAwakeningId : (prev?.syncAwakening ?? null);
    if (!prev && !info) {
      warnings.push(
        `Slot ${slot + 1}: no data for #${monsterId} yet; transform root and sync awakening omitted.`,
      );
    }

    // Keep PDC's exact level when PST shows the same bracket (e.g. 115 stays 115).
    const pstLevelValue = toPdcLevel(member.level);
    const level =
      prev && pstLevel(prev.level) === pstLevelValue
        ? prev.level
        : info?.maxLevel != null
          ? Math.min(pstLevelValue, info.maxLevel)
          : pstLevelValue;

    members.push({
      slot,
      monsterId,
      transformBaseId,
      latents: prev ? [...prev.latents] : [],
      level,
      plusHp: toPdcPlus(member.plusHp),
      plusAtk: toPdcPlus(member.plusAtk),
      plusRcv: toPdcPlus(member.plusRcv),
      unknown07: prev?.unknown07 ?? -1,
      superAwakening: member.selectedSuperAwakening ?? 0,
      syncAwakening,
      assist:
        assistId == null
          ? null
          : {
              id: assistId,
              level: prevAssist?.level ?? assistInfo?.assistLevel ?? DEFAULT_ASSIST_LEVEL,
              plusHp: toPdcPlus(member.eqPlusHp),
              plusAtk: toPdcPlus(member.eqPlusAtk),
              plusRcv: toPdcPlus(member.eqPlusRcv),
              unknown0e: prevAssist?.unknown0e ?? -1,
            },
      extraEntries: { ...(prev?.extraEntries ?? {}) },
      keyOrder: prev?.keyOrder ? [...prev.keyOrder] : undefined,
    });
  });

  const team: PdcTeam = {
    header: previous?.header ?? PDC_DEFAULT_HEADER,
    badge: resolveBadge(config, previous, warnings),
    members,
  };
  return { team, text: serializePdcTeamString(team), warnings };
}
