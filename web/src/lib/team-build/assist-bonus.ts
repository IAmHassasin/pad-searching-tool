import type { MonsterRecord } from "../../types.ts";
import type { MonsterLevelTarget } from "./types.ts";
import {
  ASSIST_BONUS_PCT,
  ASSIST_BONUS_PLUS_CAP,
  PLUS_ATK_PER_POINT,
  PLUS_HP_PER_POINT,
  PLUS_RCV_PER_POINT,
} from "./stat-reference.ts";
import { scaleStatForLevel } from "./level-scaling.ts";

function sharesAssistAttribute(
  base: MonsterRecord,
  assist: MonsterRecord
): boolean {
  const a1 = base.attribute_1_id;
  const a2 = assist.attribute_1_id;
  if (a1 == null || a2 == null) return true;
  if (a1 === 6 || a2 === 6) return true;
  return a1 === a2;
}

function assistStatAtLevel(
  assist: MonsterRecord,
  level: MonsterLevelTarget,
  stat: "hp" | "atk" | "rcv",
  plusPoints: number
): number {
  const base =
    stat === "hp" ? assist.hp_max : stat === "atk" ? assist.atk_max : assist.rcv_max;
  if (base == null || !Number.isFinite(base)) return 0;
  const scaled = scaleStatForLevel(base, assist, level, stat);
  const plusFlat =
    stat === "hp"
      ? plusPoints * PLUS_HP_PER_POINT
      : stat === "atk"
        ? plusPoints * PLUS_ATK_PER_POINT
        : plusPoints * PLUS_RCV_PER_POINT;
  return scaled + plusFlat;
}

/**
 * Plus points of the assist that count toward the assist bonus: points gained through
 * ＋限界突破 (above +99 per stat) are not reflected.
 */
export function assistBonusPlus(plusPoints: number): number {
  const n = Number.isFinite(plusPoints) ? plusPoints : 0;
  return Math.max(0, Math.min(ASSIST_BONUS_PLUS_CAP, n));
}

/** HP +10%, ATK +5%, RCV +15% of the assist's stats when main attributes match. */
export function computeAssistBonus(
  base: MonsterRecord,
  assist: MonsterRecord | null,
  eqLevel: MonsterLevelTarget,
  eqPlusHp: number,
  eqPlusRcv: number,
  eqPlusAtk = 0
): { hp: number; atk: number; rcv: number } {
  if (!assist || !sharesAssistAttribute(base, assist)) {
    return { hp: 0, atk: 0, rcv: 0 };
  }
  const assistHp = assistStatAtLevel(assist, eqLevel, "hp", assistBonusPlus(eqPlusHp));
  const assistAtk = assistStatAtLevel(assist, eqLevel, "atk", assistBonusPlus(eqPlusAtk));
  const assistRcv = assistStatAtLevel(assist, eqLevel, "rcv", assistBonusPlus(eqPlusRcv));
  return {
    hp: Math.round(assistHp * (ASSIST_BONUS_PCT.hp / 100)),
    atk: Math.round(assistAtk * (ASSIST_BONUS_PCT.atk / 100)),
    rcv: Math.round(assistRcv * (ASSIST_BONUS_PCT.rcv / 100)),
  };
}
