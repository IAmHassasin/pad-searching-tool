import type { MonsterRecord } from "../../types";
import { resolveSuperAwakeningIds } from "../awakenings";
import type { MonsterLevelTarget } from "./types";
import { LEVEL_120_EXTRA_PCT } from "./stat-reference";

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

/**
 * Cards with sync awakening (no SA list) and no limit break use hp_max × 1.1 in-game.
 * dadguide `hp_max` predates the sync-awakening stat adjustment for these cards.
 */
export function baseStatMultiplier(row: MonsterRecord): number {
  if (limitMult(row) > 0) return 1;
  const superIds = resolveSuperAwakeningIds(
    row.awakenings,
    row.super_awakenings
  );
  if (superIds.length > 0) return 1;
  const sync = Number(row.sync_awsid);
  return Number.isFinite(sync) && sync > 0 ? 1.1 : 1;
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

  if (exp >= 1_000_000_000) return lm * 2;
  if (exp >= 50_000_000) return lm * 0.6;
  if (exp >= 5_000_000 && lm >= 50) return lm / 3.52;

  if (exp === 4_000_000) {
    if (cost > 0 && cost === lm) return lm;
    if (cost > 0 && cost < lm) return lm + cost - 11;
    if (cost > lm) {
      // Small cost excess (e.g. Hathor cost35 lm30) keeps base limit_mult %.
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

/** 1B-exp cards use sequential 110→120; others add SLB% on Lv.99 base (039日記). */
function usesSequentialSlb(row: MonsterRecord): boolean {
  return (Number(row.exp) || 0) >= 1_000_000_000;
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

  if (usesSequentialSlb(row)) {
    return Math.round(at110 * (1 + slb / 100));
  }
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
