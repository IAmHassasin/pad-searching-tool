import type { MonsterRecord } from "../../types.ts";
import { parseRegularAwakenings } from "../awakenings.ts";
import type { MonsterLevelTarget } from "./types.ts";
import { LEVEL_120_EXTRA_PCT } from "./stat-reference.ts";

function limitMult(row: MonsterRecord): number {
  const raw = Number(row.limit_mult);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function monsterCost(row: MonsterRecord): number {
  const raw = Number(row.cost);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/** Post-transform dungeon forms (`transformations.to_monster_id`) cap at Lv.99. */
export function isTransformForm(row: MonsterRecord): boolean {
  const v = row.is_transform_form;
  return v === true || v === 1 || v === "1";
}

export function maxMonsterLevel(row: MonsterRecord): MonsterLevelTarget {
  if (isTransformForm(row)) return 99;
  return limitMult(row) > 0 ? 120 : 99;
}

export function clampMonsterLevel(
  row: MonsterRecord,
  level: MonsterLevelTarget
): MonsterLevelTarget {
  const max = maxMonsterLevel(row);
  return level > max ? max : level;
}

/** Skill Voice: "increase base stats by 10%". */
export const SKILL_VOICE_AWAKENING_ID = 63;
export const SKILL_VOICE_BASE_MULT = 1.1;

/**
 * Skill Voice (63) multiplies the Lv.99 base by 1.1 before level scaling and
 * +points; dadguide stores the base without it. In-game: 7943 Lv99 +297 =
 * round(4586 × 1.1) + 990 = 6035; Denken 13422 and Mina 12905 (PDC) agree.
 */
export function baseStatMultiplier(row: MonsterRecord): number {
  const regular = parseRegularAwakenings(row.awakenings);
  const sync = Number(row.sync_awsid);
  if (
    regular.includes(SKILL_VOICE_AWAKENING_ID) ||
    sync === SKILL_VOICE_AWAKENING_ID
  ) {
    return SKILL_VOICE_BASE_MULT;
  }
  return 1;
}

/**
 * Lv.99→110 increase % from `limit_mult`, `exp`, and `cost`.
 * 4M-exp curve also adjusts LB% from cost vs `limit_mult`.
 */
export function lb110Percent(row: MonsterRecord): number {
  const lm = limitMult(row);
  if (lm <= 0) return 0;
  const exp = Number(row.exp) || 0;
  const cost = monsterCost(row);

  // 1B-exp cards: altema lists Odin 12806 (lm10) at Lv110 = ×1.1 and PDC
  // fits Zelclea 13483 (lm10) with +10%, so limit_mult is used directly.
  if (exp >= 1_000_000_000) return lm;
  if (exp >= 50_000_000) return lm * 0.6;
  if (exp >= 5_000_000 && lm >= 50) return lm / 3.52;

  if (exp === 4_000_000) {
    if (cost > 0 && cost === lm) return lm;
    if (cost > 0 && cost < lm) return lm + cost - 11;
    if (cost > lm) {
      // Small cost excess (e.g. Hathor cost35 lm30) keeps base limit_mult %.
      // Small cost excess (Hathor lm30 cost35, Mina & Soshiro lm30 cost40) keeps limit_mult %.
      if (cost - lm < 15) return lm;
      if (cost >= 50) return lm + 14;
      // cost 45 tier: high-HP cards (e.g. Serie) use cost−10, not lm+14.
      if (cost > lm && cost < 50 && (Number(row.hp_max) || 0) >= 7200) {
        return cost - 10;
      }
      return lm + 14;
    }
  }

  return lm;
}

/**
 * Scale Lv.99 base stat to 110 / 120.
 * Plus points are applied separately after this step.
 */
export function scaleStatForLevel(
  baseLv99: number,
  row: MonsterRecord,
  level: MonsterLevelTarget,
  stat: "hp" | "atk" | "rcv"
): number {
  if (!Number.isFinite(baseLv99) || baseLv99 < 0) return 0;

  level = clampMonsterLevel(row, level);
  const base = baseLv99 * baseStatMultiplier(row);
  if (level === 99) return Math.round(base);

  const lb = lb110Percent(row);
  const slb =
    stat === "hp"
      ? LEVEL_120_EXTRA_PCT.hp
      : stat === "atk"
        ? LEVEL_120_EXTRA_PCT.atk
        : LEVEL_120_EXTRA_PCT.rcv;

  if (lb <= 0) return Math.round(base);

  const at110 = Math.round(base * (1 + lb / 100));
  if (level === 110) return at110;

  // Lv.120 adds the SLB % on top of the LB % (additive on the Lv.99 base):
  // 命天龍・ゼルクレア 11210 Lv120 = 8124 × 1.4 = 11374; PDC Zelclea 13483
  // (1B exp) = base × 1.2, not 1.1 × 1.1.
  const totalPct = 1 + lb / 100 + slb / 100;
  const exp = Number(row.exp) || 0;
  const cost = monsterCost(row);
  const lm = limitMult(row);
  if (exp === 4_000_000 && cost > lm) {
    return Math.round(base * totalPct);
  }
  return Math.ceil(base * totalPct);
}

export function canReachLevel(
  row: MonsterRecord,
  level: MonsterLevelTarget
): boolean {
  if (level === 99) return true;
  if (isTransformForm(row)) return false;
  return limitMult(row) > 0;
}
