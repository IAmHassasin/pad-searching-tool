import { parseMonsterTypeIds } from "../monster-types.ts";
import type { MonsterRecord } from "../../types.ts";
import type { TeamBadgeId } from "./types.ts";
import { BADGE_TEAM_PCT, BADGE_TYPE_ATK } from "./stat-reference.ts";

/** Team-wide badge percentage (HP / RCV / ATK) plus type-badge ATK ×5 for matching members. */
export function badgeMultiplier(
  badge: TeamBadgeId,
  stat: "hp" | "atk" | "rcv",
  row?: MonsterRecord | null
): number {
  const pct = Object.hasOwn(BADGE_TEAM_PCT, badge)
    ? BADGE_TEAM_PCT[badge]
    : BADGE_TEAM_PCT.none;
  const add = typeof pct[stat] === "number" ? Math.max(0, pct[stat]) : 0;
  let mult = 1 + add / 100;
  if (stat === "atk" && row) {
    const typeAtk = BADGE_TYPE_ATK[badge];
    if (typeAtk && parseMonsterTypeIds(row).includes(typeAtk.typeId)) {
      mult *= typeAtk.mult;
    }
  }
  return mult;
}

export function applyTeamBadge(
  value: number,
  badge: TeamBadgeId,
  stat: "hp" | "atk" | "rcv",
  row?: MonsterRecord | null
): number {
  const mult = badgeMultiplier(badge, stat, row);
  if (mult === 1) return value;
  return Math.round(value * mult);
}
