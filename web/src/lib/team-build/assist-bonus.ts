import type { MonsterRecord } from "../../types";
import type { MonsterLevelTarget } from "./types";
import { ASSIST_BONUS_PCT, PLUS_HP_PER_POINT, PLUS_RCV_PER_POINT } from "./stat-reference";
import { scaleStatForLevel } from "./level-scaling";

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
  stat: "hp" | "rcv",
  plusPoints: number
): number {
  const base = stat === "hp" ? assist.hp_max : assist.rcv_max;
  if (base == null || !Number.isFinite(base)) return 0;
  const scaled = scaleStatForLevel(base, assist, level, stat);
  const plusFlat =
    stat === "hp"
      ? plusPoints * PLUS_HP_PER_POINT
      : plusPoints * PLUS_RCV_PER_POINT;
  return scaled + plusFlat;
}

export function computeAssistBonus(
  base: MonsterRecord,
  assist: MonsterRecord | null,
  eqLevel: MonsterLevelTarget,
  eqPlusHp: number,
  eqPlusRcv: number
): { hp: number; rcv: number } {
  if (!assist || !sharesAssistAttribute(base, assist)) {
    return { hp: 0, rcv: 0 };
  }
  const assistHp = assistStatAtLevel(assist, eqLevel, "hp", eqPlusHp);
  const assistRcv = assistStatAtLevel(assist, eqLevel, "rcv", eqPlusRcv);
  return {
    hp: Math.round(assistHp * (ASSIST_BONUS_PCT.hp / 100)),
    rcv: Math.round(assistRcv * (ASSIST_BONUS_PCT.rcv / 100)),
  };
}
