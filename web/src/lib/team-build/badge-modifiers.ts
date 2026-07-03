import type { TeamBadgeId } from "./types";
import { BADGE_TEAM_PCT } from "./stat-reference";

export function applyTeamBadge(
  value: number,
  badge: TeamBadgeId,
  stat: "hp" | "rcv"
): number {
  const pct = BADGE_TEAM_PCT[badge];
  const add = stat === "hp" ? pct.hp : pct.rcv;
  if (add <= 0) return value;
  return Math.round(value * (1 + add / 100));
}
