import {
  parseRegularAwakenings,
  resolveSuperAwakeningIds,
} from "./awakenings";
import type { MonsterRecord } from "../types";

/** Killer awakening ids — each grants ×5 ATK when active. */
export const KILLER_AWAKENING_IDS = [
  31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
] as const;

/** Hidden from modifier UI but auto-enabled with parent awks (111→61, 114→81). */
export const HIDDEN_MODIFIER_AWAKENING_IDS = [
  43, 61, 79, 80, 81, 48, 78, 27, 60,
] as const;

/** Awakening ids shown in the modifier picker (excludes hidden). */
export const MODIFIER_AWAKENING_IDS: number[] = [
  128, 129, 138, 139, 130, 132, 106, 30, 127, 142, 143, 131, 63,
  107, 111, 96, 57, 58, 109, 108, 59, 126, 50, 71,
  110, 112, 113, 114, 141, 44, 82, 133, 134, 135,
  ...KILLER_AWAKENING_IDS,
];

export function getModifierAwksForStat(stat: "hp" | "atk" | "rcv"): number[] {
  return MODIFIER_AWAKENING_IDS.filter((id) => {
    const m = getAwakeningStatMultipliers(id, DEFAULT_AWK_MODIFIER_SETTINGS);
    return m[stat] !== 1;
  });
}

export type StatMultipliers = {
  hp: number;
  atk: number;
  rcv: number;
};

export type AwkModifierSettings = {
  /** Awakening ids the user allows to affect stat sorting. */
  enabled: number[];
  /** Yin/Yang Protection — only one may be enabled. */
  yinYang: 128 | 129 | null;
  /** Self-Reliance vs Assist Resonate — only one may be enabled. */
  selfOrAssist: 138 | 139 | null;
  /** Aging battle threshold. */
  agingBattle: 5 | 10;
  /** Combo count for awk 43 (7 → ×2 ATK, 14 → ×3 ATK). */
  combo43: 7 | 14;
  /** Awk 57 vs 58 — only one may be enabled. */
  atk57or58: 57 | 58 | null;
  /** Battle threshold for awk 143 ATK scaling. */
  battle143: 3 | 6 | 9 | 12 | 15;
  /** Broken parts for awk 131 (0–10, ×1.2 each). */
  parts131: number;
};

export const DEFAULT_AWK_MODIFIER_SETTINGS: AwkModifierSettings = {
  enabled: [],
  yinYang: null,
  selfOrAssist: null,
  agingBattle: 10,
  combo43: 14,
  atk57or58: null,
  battle143: 15,
  parts131: 10,
};

const ALL_STATS = (n: number): StatMultipliers => ({ hp: n, atk: n, rcv: n });
const ATK_ONLY = (n: number): StatMultipliers => ({ hp: 1, atk: n, rcv: 1 });
const HP_RCV_ATK = (
  hp: number,
  rcv: number,
  atk: number
): StatMultipliers => ({ hp, atk, rcv });

function atk143ForBattle(battle: AwkModifierSettings["battle143"]): number {
  switch (battle) {
    case 3:
      return 30;
    case 6:
      return 60;
    case 9:
      return 90;
    case 12:
      return 120;
    default:
      return 150;
  }
}

function combo43Atk(combo: AwkModifierSettings["combo43"]): number {
  return combo === 7 ? 2 : 3;
}

/** Multiplier for a single awakening id given current modifier options. */
export function getAwakeningStatMultipliers(
  awkId: number,
  settings: AwkModifierSettings
): StatMultipliers {
  switch (awkId) {
    case 128:
    case 129:
      return HP_RCV_ATK(2, 2, 5);
    case 138:
    case 139:
      return ALL_STATS(3);
    case 130:
      return ALL_STATS(settings.agingBattle === 5 ? 1.5 : 2);
    case 106:
      return ATK_ONLY(20);
    case 132:
      return ALL_STATS(1.25);
    case 30:
      return ALL_STATS(1.5);
    case 127:
      return ALL_STATS(1.5);
    case 142:
      return ALL_STATS(1.8);
    case 143:
      return ATK_ONLY(atk143ForBattle(settings.battle143));
    case 131:
      return ALL_STATS(Math.pow(1.2, Math.max(0, Math.min(10, settings.parts131))));
    case 63:
      return ALL_STATS(1.1);
    case 43:
      return ATK_ONLY(combo43Atk(settings.combo43));
    case 61:
      return ATK_ONLY(5);
    case 107: {
      const base = combo43Atk(settings.combo43);
      return ATK_ONLY(base * base);
    }
    case 111:
      return ATK_ONLY(25);
    case 27:
      return ATK_ONLY(2.2);
    case 96:
      return ATK_ONLY(4.84);
    case 57:
    case 58:
      return ATK_ONLY(2);
    case 48:
      return ATK_ONLY(3.5);
    case 109:
      return ATK_ONLY(12.25);
    case 60:
      return ATK_ONLY(2.2);
    case 108:
      return ATK_ONLY(4.84);
    case 59:
      return ATK_ONLY(3);
    case 126:
    case 50:
      return ATK_ONLY(8);
    case 71:
      return ATK_ONLY(2);
    case 78:
      return ATK_ONLY(3);
    case 110:
      return ATK_ONLY(9);
    case 79:
      return ATK_ONLY(2.5);
    case 80:
      return ATK_ONLY(4);
    case 81:
      return ATK_ONLY(5);
    case 112:
      return ATK_ONLY(6.25);
    case 113:
      return ATK_ONLY(16);
    case 114:
      return ATK_ONLY(25);
    case 141:
      return ATK_ONLY(50);
    case 44:
      return ATK_ONLY(3);
    case 82:
      return ATK_ONLY(12);
    case 133:
    case 134:
    case 135:
      return ATK_ONLY(50);
    default:
      if ((KILLER_AWAKENING_IDS as readonly number[]).includes(awkId)) {
        return ATK_ONLY(5);
      }
      return ALL_STATS(1);
  }
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

  for (const awkId of settings.enabled) {
    if (slots.regular.includes(awkId) || slots.sync === awkId) {
      applyAwk(awkId);
    }
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

function isAwkEnabled(awkId: number, settings: AwkModifierSettings): boolean {
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
