import { getAwakeningStatMultipliers } from "../awakening-stat-modifier.ts";
import {
  parseRegularAwakenings,
  resolveSuperAwakeningIds,
} from "../awakenings.ts";
import {
  DEFAULT_AWK_MODIFIER_SETTINGS,
  type StatMultipliers,
} from "../damage/awakening-multipliers.ts";
import { parseMonsterTypeIds } from "../monster-types.ts";
import type { MonsterRecord } from "../../types.ts";

/**
 * Stat awakenings that are always active on the team screen (no dungeon or
 * multiplayer condition): Enhanced Stat(+), Afternoon Tea, Souls.
 * Skill Voice (63) is deliberately excluded: PDC's team stats do not apply it
 * (Zelclea Lv120 +297 → ×4 from two Yang Protections, no ×1.1).
 */
export const UNCONDITIONAL_PASSIVE_AWAKENING_IDS = [
  127, 142, 132, 145, 146, 147,
] as const;

export const ASSIST_RESONANCE_ID = 138;
export const SELF_RELIANCE_ID = 139;
/** Awoken Assist: the equipment's awakenings are granted to the base card. */
export const AWOKEN_ASSIST_ID = 49;

/**
 * Regular awakenings an assist grants to its base card (only when the
 * assist has Awoken Assist 49). The 49 itself is not a stat awakening.
 */
export function grantedAssistAwakenings(assist: MonsterRecord | null): number[] {
  if (!assist) return [];
  const ids = parseRegularAwakenings(assist.awakenings);
  if (!ids.includes(AWOKEN_ASSIST_ID)) return [];
  return ids.filter((id) => id !== AWOKEN_ASSIST_ID);
}

/** Every passive id the raw-stat stage resolves itself (excluded from the manual awk modal). */
export const RAW_PASSIVE_AWAKENING_IDS: readonly number[] = [
  ...UNCONDITIONAL_PASSIVE_AWAKENING_IDS,
  ASSIST_RESONANCE_ID,
  SELF_RELIANCE_ID,
];

/**
 * Assist Resonance: base and assist share the main attribute and at least one
 * type (added types are not in the record, so only the card's own types count).
 */
export function assistResonanceApplies(
  base: MonsterRecord,
  assist: MonsterRecord | null
): boolean {
  if (!assist) return false;
  const a1 = base.attribute_1_id;
  const a2 = assist.attribute_1_id;
  if (a1 == null || a2 == null || a1 !== a2) return false;
  const baseTypes = parseMonsterTypeIds(base);
  const assistTypes = parseMonsterTypeIds(assist);
  return baseTypes.some((t) => assistTypes.includes(t));
}

/** Whether a passive awakening contributes given the slot's assist state. */
export function passiveAwakeningActive(
  awkId: number,
  base: MonsterRecord,
  assist: MonsterRecord | null
): boolean {
  if (awkId === ASSIST_RESONANCE_ID) return assistResonanceApplies(base, assist);
  if (awkId === SELF_RELIANCE_ID) return assist == null;
  return (UNCONDITIONAL_PASSIVE_AWAKENING_IDS as readonly number[]).includes(awkId);
}

function collectPassiveSlots(row: MonsterRecord, assist: MonsterRecord | null): number[] {
  const ids = parseRegularAwakenings(row.awakenings);
  const sync = Number(row.sync_awsid);
  // A sync awakening is a permanent slot, unlike super awakenings (user-selected).
  if (Number.isFinite(sync) && sync > 0) ids.push(sync);
  // Unconditional passives granted by the assist (Awoken Assist). The
  // assist-conditional ones (138 / 139) only make sense on the base card.
  for (const id of grantedAssistAwakenings(assist)) {
    if ((UNCONDITIONAL_PASSIVE_AWAKENING_IDS as readonly number[]).includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Multiplier from the card's regular (+ sync) passive stat awakenings that are
 * active on the team screen. Super awakenings are handled by the slot's
 * selection, dungeon-conditional awakenings by the dungeon settings.
 */
export function passiveAwakeningMultipliers(
  row: MonsterRecord,
  assist: MonsterRecord | null
): StatMultipliers {
  const out = { hp: 1, atk: 1, rcv: 1 };
  for (const id of collectPassiveSlots(row, assist)) {
    if (!RAW_PASSIVE_AWAKENING_IDS.includes(id)) continue;
    if (!passiveAwakeningActive(id, row, assist)) continue;
    const m = getAwakeningStatMultipliers(id, DEFAULT_AWK_MODIFIER_SETTINGS);
    out.hp *= m.hp;
    out.atk *= m.atk;
    out.rcv *= m.rcv;
  }
  return out;
}

/** Ids a card can pick as super awakening that resolve through this module. */
export function superAwakeningIsPassive(awkId: number): boolean {
  return RAW_PASSIVE_AWAKENING_IDS.includes(awkId);
}

/** True when the card offers the awakening as a super awakening option. */
export function hasSuperAwakeningOption(row: MonsterRecord, awkId: number): boolean {
  return resolveSuperAwakeningIds(row.awakenings, row.super_awakenings).includes(
    awkId
  );
}
