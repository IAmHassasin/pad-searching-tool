import {
  parseRegularAwakenings,
  resolveSuperAwakeningIds,
} from "./awakenings.ts";
import type { MonsterRecord } from "../types";

import {
  AWAKENING_MULTIPLIERS,
  awakeningStatMultipliers,
  DEFAULT_AWK_MODIFIER_SETTINGS,
  KILLER_AWAKENING_IDS,
  type AwkModifierSettings,
  type StatMultipliers,
} from "./damage/awakening-multipliers.ts";

export {
  DEFAULT_AWK_MODIFIER_SETTINGS,
  KILLER_AWAKENING_IDS,
  type AwkModifierSettings,
  type StatMultipliers,
};

/** Hidden from modifier UI but auto-enabled with parent awks (111→61, 114→81). */
export const HIDDEN_MODIFIER_AWAKENING_IDS = [
  43, 61, 79, 80, 81, 48, 78, 27, 60,
] as const;

/** Awakening ids shown in the modifier picker (excludes hidden). */
export const MODIFIER_AWAKENING_IDS: number[] = [
  128, 129, 138, 139, 130, 132, 106, 30, 127, 142, 143, 131, 63,
  145, 146, 147, 149, 150, 151, 152, 153, 107, 111, 144, 96, 57, 58, 109, 108, 59, 126, 50, 71, 72,
  110, 112, 113, 114, 141, 44, 82, 133, 134, 135,
  ...KILLER_AWAKENING_IDS,
];

export function getModifierAwksForStat(stat: "hp" | "atk" | "rcv"): number[] {
  return MODIFIER_AWAKENING_IDS.filter((id) => {
    const m = getAwakeningStatMultipliers(id, DEFAULT_AWK_MODIFIER_SETTINGS);
    return m[stat] !== 1;
  });
}

/**
 * Multiplier for a single awakening id given current modifier options.
 * Values come from the shared table in `./damage/awakening-multipliers`.
 */
export function getAwakeningStatMultipliers(
  awkId: number,
  settings: AwkModifierSettings
): StatMultipliers {
  if (!(awkId in AWAKENING_MULTIPLIERS)) return { hp: 1, atk: 1, rcv: 1 };
  return awakeningStatMultipliers(awkId, settings);
}

function computeStatMultiplier(
  row: MonsterRecord,
  settings: AwkModifierSettings,
  stat: "hp" | "atk" | "rcv"
): number {
  if (!settings.enabled.length) return 1;

  const slots = collectMonsterAwkSlots(row);
  const skipAssistResonate = monsterHasAwk30(slots);
  let mult = 1;

  const applyAwk = (awkId: number) => {
    if (!isAwkEnabled(awkId, settings)) return;
    if (!monsterHasAwkInSlots(slots, awkId)) return;
    if (awkId === 138 && skipAssistResonate) return;
    mult *= getAwakeningStatMultipliers(awkId, settings)[stat];
  };

  // Each copy multiplies (two Yang Protections = HP ×4, ATK ×25); the sync
  // awakening counts as one more copy.
  for (const awkId of settings.enabled) {
    let copies = slots.regular.filter((id) => id === awkId).length;
    if (slots.sync === awkId) copies += 1;
    for (let i = 0; i < copies; i += 1) applyAwk(awkId);
  }

  let bestSuper = 1;
  for (const awkId of settings.enabled) {
    if (!slots.super.includes(awkId) || !isAwkEnabled(awkId, settings)) continue;
    if (awkId === 138 && skipAssistResonate) continue;
    const m = getAwakeningStatMultipliers(awkId, settings)[stat];
    if (m > bestSuper) bestSuper = m;
  }
  mult *= bestSuper;

  return mult;
}

/** True when the id is in the enabled list and wins its exclusive pair (128/129, 138/139, 57/58). */
export function isAwkEnabled(awkId: number, settings: AwkModifierSettings): boolean {
  const enabled = new Set(settings.enabled);
  if (!enabled.has(awkId)) return false;

  if ((awkId === 128 || awkId === 129) && settings.yinYang !== awkId) {
    return false;
  }
  if ((awkId === 138 || awkId === 139) && settings.selfOrAssist !== awkId) {
    return false;
  }
  if ((awkId === 57 || awkId === 58) && settings.atk57or58 !== awkId) {
    return false;
  }
  return true;
}

type MonsterAwkSlots = {
  regular: number[];
  super: number[];
  sync: number | null;
};

function collectMonsterAwkSlots(row: MonsterRecord): MonsterAwkSlots {
  const syncRaw = Number(row.sync_awsid);
  return {
    regular: parseRegularAwakenings(row.awakenings),
    super: resolveSuperAwakeningIds(row.awakenings, row.super_awakenings),
    sync: Number.isFinite(syncRaw) && syncRaw > 0 ? syncRaw : null,
  };
}

function monsterHasAwkInSlots(slots: MonsterAwkSlots, awkId: number): boolean {
  if (slots.regular.includes(awkId)) return true;
  if (slots.super.includes(awkId)) return true;
  return slots.sync === awkId;
}

function monsterHasAwk30(slots: MonsterAwkSlots): boolean {
  return monsterHasAwkInSlots(slots, 30);
}

/** Combined multiplier from enabled awakenings the monster actually has. */
export function computeMonsterStatMultipliers(
  row: MonsterRecord,
  settings: AwkModifierSettings
): StatMultipliers {
  return {
    hp: computeStatMultiplier(row, settings, "hp"),
    atk: computeStatMultiplier(row, settings, "atk"),
    rcv: computeStatMultiplier(row, settings, "rcv"),
  };
}

export function computeModifiedStat(
  row: MonsterRecord,
  settings: AwkModifierSettings,
  stat: "hp" | "atk" | "rcv"
): number {
  const base =
    stat === "hp"
      ? row.hp_max
      : stat === "atk"
        ? row.atk_max
        : row.rcv_max;
  if (base == null || !Number.isFinite(base)) return -1;
  return base * computeStatMultiplier(row, settings, stat);
}

/** Auto-enable dependent awakenings when toggling one on. */
export function withAwkEnabled(
  settings: AwkModifierSettings,
  awkId: number,
  on: boolean
): AwkModifierSettings {
  const enabled = new Set(settings.enabled);
  let next: AwkModifierSettings = { ...settings };

  if (on) {
    enabled.add(awkId);
    if (awkId === 111) {
      enabled.add(61);
    }
    if (awkId === 114) {
      enabled.add(81);
    }
    if (awkId === 128) {
      enabled.delete(129);
      next = { ...next, yinYang: 128 };
    }
    if (awkId === 129) {
      enabled.delete(128);
      next = { ...next, yinYang: 129 };
    }
    if (awkId === 138) {
      enabled.delete(139);
      next = { ...next, selfOrAssist: 138 };
    }
    if (awkId === 139) {
      enabled.delete(138);
      next = { ...next, selfOrAssist: 139 };
    }
    if (awkId === 57) {
      enabled.delete(58);
      next = { ...next, atk57or58: 57 };
    }
    if (awkId === 58) {
      enabled.delete(57);
      next = { ...next, atk57or58: 58 };
    }
  } else {
    enabled.delete(awkId);
    if (awkId === 128 || awkId === 129) {
      next = { ...next, yinYang: null };
    }
    if (awkId === 138 || awkId === 139) {
      next = { ...next, selfOrAssist: null };
    }
    if (awkId === 57 || awkId === 58) {
      next = { ...next, atk57or58: null };
    }
  }

  return { ...next, enabled: [...enabled] };
}

export function statMultiplierLabel(awkId: number): string {
  const m = getAwakeningStatMultipliers(awkId, DEFAULT_AWK_MODIFIER_SETTINGS);
  const parts: string[] = [];
  if (m.hp !== 1) parts.push(`HP×${m.hp}`);
  if (m.atk !== 1) parts.push(`ATK×${m.atk}`);
  if (m.rcv !== 1) parts.push(`RCV×${m.rcv}`);
  return parts.length ? parts.join(", ") : "—";
}
