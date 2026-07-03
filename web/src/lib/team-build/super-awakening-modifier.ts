import {
  DEFAULT_AWK_MODIFIER_SETTINGS,
  getAwakeningStatMultipliers,
  statMultiplierLabel,
  type StatMultipliers,
} from "../awakening-stat-modifier";
import { resolvePrefixedAwakeningIds } from "../awakenings";
import type { MonsterRecord } from "../../types";

/**
 * Super awakenings that boost team-screen raw stats (passive).
 * Battle-only SAs (e.g. 130 Aging) are excluded — they do not change the HP/ATK/RCV shown on the team select screen.
 */
const RAW_STAT_SUPER_AWAKENING_IDS = new Set([
  30, 63, 127, 132, 142,
]);

export function isRawStatSuperAwakening(awkId: number): boolean {
  return RAW_STAT_SUPER_AWAKENING_IDS.has(awkId);
}

export function listSuperAwakeningOptions(row: MonsterRecord): number[] {
  return resolvePrefixedAwakeningIds(
    row.awakenings,
    row.super_awakenings,
    row.sync_awsid
  );
}

export function superAwakeningStatMultipliers(
  awkId: number | null | undefined
): StatMultipliers {
  if (awkId == null || !Number.isFinite(awkId)) {
    return { hp: 1, atk: 1, rcv: 1 };
  }
  if (!isRawStatSuperAwakening(awkId)) {
    return { hp: 1, atk: 1, rcv: 1 };
  }
  return getAwakeningStatMultipliers(awkId, DEFAULT_AWK_MODIFIER_SETTINGS);
}

export function superAwakeningAffectsStat(
  awkId: number,
  stat: "hp" | "atk" | "rcv"
): boolean {
  if (!isRawStatSuperAwakening(awkId)) return false;
  return (
    getAwakeningStatMultipliers(awkId, DEFAULT_AWK_MODIFIER_SETTINGS)[stat] !== 1
  );
}

export function superAwakeningLabel(awkId: number): string {
  return statMultiplierLabel(awkId);
}
