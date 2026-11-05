import {
  withAwkEnabled,
  type AwkModifierSettings,
} from "../awakening-stat-modifier.ts";
import { parseRegularAwakenings } from "../awakenings.ts";
import { parseMonsterTypeIds } from "../monster-types.ts";
import type { MonsterRecord } from "../../types.ts";
import {
  CUSTOM_DUNGEON_ID,
  findDungeonEntry,
  NO_DUNGEON_ID,
  type ConditionalStatBoost,
  type DungeonCatalogEntry,
  type DungeonStatMultipliers,
} from "./dungeon-catalog-types.ts";
import type { TeamBuildConfig } from "./types.ts";

export const NEUTRAL_DUNGEON_STAT: DungeonStatMultipliers = {
  hp: 1,
  atk: 1,
  rcv: 1,
};

export type ResolvedDungeonModifiers = {
  /** Team-wide multipliers applied after badge and leader skills. */
  stat: DungeonStatMultipliers;
  /** User awk selection plus the awakenings the dungeon itself activates. */
  awkSettings: AwkModifierSettings;
  /** Awakening ids the dungeon turned on (for the UI summary). */
  dungeonAwks: number[];
  /** Type / attribute limited boosts applied per member. */
  conditional: ConditionalStatBoost[];
  /** Catalog entry when `dungeonId` points at one. */
  entry: DungeonCatalogEntry | null;
  label: string;
};

/** Shape shared by catalog entries and the custom editor. */
export type DungeonFlags = {
  sun: boolean;
  moon: boolean;
  multiplayer: boolean;
  maxFloor: number | null;
};

/** Awakenings that a dungeon with these flags activates on top of `base`. */
export function applyDungeonAwakenings(
  base: AwkModifierSettings,
  flags: DungeonFlags
): { settings: AwkModifierSettings; enabled: number[] } {
  let settings = base;
  const enabled: number[] = [];
  const turnOn = (id: number) => {
    settings = withAwkEnabled(settings, id, true);
    enabled.push(id);
  };

  // Sun / Moon are exclusive in-game as well; moon wins when both are set.
  if (flags.moon) turnOn(129);
  else if (flags.sun) turnOn(128);
  if (flags.multiplayer) turnOn(30);
  if (flags.maxFloor != null && flags.maxFloor >= 5) {
    turnOn(130);
    settings = { ...settings, agingBattle: flags.maxFloor >= 10 ? 10 : 5 };
  }
  return { settings, enabled };
}

export function neutralDungeonModifiers(
  config: TeamBuildConfig
): ResolvedDungeonModifiers {
  return {
    stat: NEUTRAL_DUNGEON_STAT,
    awkSettings: config.awkSettings,
    dungeonAwks: [],
    conditional: [],
    entry: null,
    label: "No dungeon",
  };
}

/**
 * Resolve the config's dungeon selection against the catalog. `entries` is
 * injected so the JSON catalog is only imported by the UI.
 */
export function resolveDungeonModifiers(
  config: TeamBuildConfig,
  entries: DungeonCatalogEntry[]
): ResolvedDungeonModifiers {
  const id = config.dungeonId || NO_DUNGEON_ID;

  if (id === CUSTOM_DUNGEON_ID) {
    const c = config.customDungeon;
    const { settings, enabled } = applyDungeonAwakenings(config.awkSettings, {
      sun: c.sun,
      moon: c.moon,
      multiplayer: false,
      maxFloor: null,
    });
    return {
      stat: { hp: c.hp, atk: c.atk, rcv: c.rcv },
      awkSettings: settings,
      dungeonAwks: enabled,
      conditional: [],
      entry: null,
      label: "Custom dungeon",
    };
  }

  const entry = id === NO_DUNGEON_ID ? null : findDungeonEntry(entries, id);
  if (!entry) return neutralDungeonModifiers(config);

  const { settings, enabled } = applyDungeonAwakenings(config.awkSettings, entry);
  return {
    stat: entry.stat,
    awkSettings: settings,
    dungeonAwks: enabled,
    conditional: entry.conditional ?? [],
    entry,
    label: entry.nameEn,
  };
}

function memberAttributeIds(row: MonsterRecord): number[] {
  const out: number[] = [];
  for (const id of [row.attribute_1_id, row.attribute_2_id, row.attribute_3_id]) {
    if (id != null && id >= 0 && !out.includes(id)) out.push(id);
  }
  return out;
}

export function conditionalBoostApplies(
  boost: ConditionalStatBoost,
  row: MonsterRecord
): boolean {
  const hasTypes = (boost.types?.length ?? 0) > 0;
  const hasAttrs = (boost.attributes?.length ?? 0) > 0;
  if (!hasTypes && !hasAttrs) return false;
  if (hasTypes) {
    const types = parseMonsterTypeIds(row);
    if (!boost.types!.some((t) => types.includes(t))) return false;
  }
  if (hasAttrs) {
    const attrs = memberAttributeIds(row);
    if (!boost.attributes!.some((a) => attrs.includes(a))) return false;
  }
  return true;
}

/** Product of the conditional boosts that match this member for one stat. */
export function conditionalStatMultiplier(
  boosts: ConditionalStatBoost[],
  row: MonsterRecord,
  kind: "hp" | "atk" | "rcv"
): number {
  let mult = 1;
  for (const b of boosts) {
    if (!conditionalBoostApplies(b, row)) continue;
    const v = b[kind];
    if (Number.isFinite(v) && v > 0) mult *= v;
  }
  return mult;
}

const LEVITATION_ID = 106;
/** Levitation restores ATK ×20 under super gravity (1/500 → 1/25). */
export const LEVITATION_ATK_MULT = 20;

/** ×20 for cards with Levitation when the dungeon is a super-gravity one. */
export function levitationMultiplier(
  row: MonsterRecord,
  dungeon: ResolvedDungeonModifiers
): number {
  const superGravity =
    dungeon.entry?.superGravity != null ||
    (dungeon.entry == null && dungeon.stat.atk > 0 && dungeon.stat.atk < 0.1);
  if (!superGravity) return 1;
  const ids = parseRegularAwakenings(row.awakenings);
  const sync = Number(row.sync_awsid);
  if (ids.includes(LEVITATION_ID) || sync === LEVITATION_ID) return LEVITATION_ATK_MULT;
  return 1;
}

export function applyDungeonStat(
  value: number,
  stat: DungeonStatMultipliers,
  kind: "hp" | "atk" | "rcv"
): number {
  const mult = stat[kind];
  if (!Number.isFinite(mult) || mult === 1) return value;
  return Math.round(value * Math.max(0, mult));
}

const TYPE_SHORT: Record<number, string> = {
  1: "Balance",
  2: "Physical",
  3: "Healer",
  4: "Dragon",
  5: "God",
  6: "Attacker",
  7: "Devil",
  8: "Machine",
};
const ATTR_SHORT: Record<number, string> = {
  0: "Fire",
  1: "Water",
  2: "Wood",
  3: "Light",
  4: "Dark",
};

/** "1/2500" for tiny super-gravity factors, otherwise the plain number. */
export function formatStatMultiplier(value: number): string {
  if (value > 0 && value < 0.1) {
    const inv = 1 / value;
    const rounded = Math.round(inv);
    if (Math.abs(inv - rounded) < 0.05) return `1/${rounded}`;
    return `1/${inv.toFixed(1)}`;
  }
  return String(Math.round(value * 1000) / 1000);
}

/** Short chips such as "HP ×0.5", "ATK ×1/2500", "Sun", "Healer HP ×1.5". */
export function describeDungeonModifiers(
  stat: DungeonStatMultipliers,
  flags: Partial<DungeonFlags> & { conditional?: ConditionalStatBoost[] }
): string[] {
  const out: string[] = [];
  if (flags.sun) out.push("Sun");
  if (flags.moon) out.push("Moon");
  if (flags.multiplayer) out.push("Multiplayer");
  for (const kind of ["hp", "atk", "rcv"] as const) {
    if (stat[kind] !== 1) {
      out.push(`${kind.toUpperCase()} ×${formatStatMultiplier(stat[kind])}`);
    }
  }
  for (const b of flags.conditional ?? []) {
    const who = [
      ...(b.types ?? []).map((t) => TYPE_SHORT[t] ?? `type ${t}`),
      ...(b.attributes ?? []).map((a) => ATTR_SHORT[a] ?? `attr ${a}`),
    ].join("/");
    const parts: string[] = [];
    for (const kind of ["hp", "atk", "rcv"] as const) {
      if (b[kind] !== 1) parts.push(`${kind.toUpperCase()} ×${formatStatMultiplier(b[kind])}`);
    }
    if (who && parts.length) out.push(`${who} ${parts.join(" ")}`);
  }
  if (flags.maxFloor != null && flags.maxFloor >= 5) {
    out.push(`Aging B${flags.maxFloor >= 10 ? 10 : 5}`);
  }
  return out;
}
