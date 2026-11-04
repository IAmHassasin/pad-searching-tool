import { parseRegularAwakenings } from "../awakenings.ts";
import { grantedAssistAwakenings } from "./passive-awakenings.ts";
import type { TeamMemberConfig } from "./types.ts";
import type { MonsterRecord } from "../../types.ts";

export type TeamAwakeningCount = {
  id: number;
  /** Copies on the cards themselves (regular + sync + chosen super awakening). */
  fromCards: number;
  /** Copies granted by assists with Awoken Assist. */
  fromAssists: number;
  total: number;
};

export type TeamAwakeningSlotInput = {
  member: TeamMemberConfig;
  monster: MonsterRecord | null;
  eq: MonsterRecord | null;
};

/** Awakening ids one slot brings to the team (cards + assist grants). */
export function slotAwakeningIds(slot: TeamAwakeningSlotInput): {
  card: number[];
  assist: number[];
} {
  if (!slot.monster) return { card: [], assist: [] };
  const card = parseRegularAwakenings(slot.monster.awakenings);
  const sync = Number(slot.monster.sync_awsid);
  if (Number.isFinite(sync) && sync > 0) card.push(sync);
  if (slot.member.selectedSuperAwakening != null) card.push(slot.member.selectedSuperAwakening);
  return { card, assist: grantedAssistAwakenings(slot.eq) };
}

/**
 * Counts every awakening across the team, sorted by total (desc) then id, so
 * the panel can show the whole team when no slot is selected.
 */
export function countTeamAwakenings(slots: TeamAwakeningSlotInput[]): TeamAwakeningCount[] {
  const map = new Map<number, TeamAwakeningCount>();
  const bump = (id: number, key: "fromCards" | "fromAssists") => {
    const row = map.get(id) ?? { id, fromCards: 0, fromAssists: 0, total: 0 };
    row[key] += 1;
    row.total += 1;
    map.set(id, row);
  };
  for (const slot of slots) {
    const ids = slotAwakeningIds(slot);
    for (const id of ids.card) bump(id, "fromCards");
    for (const id of ids.assist) bump(id, "fromAssists");
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.id - b.id);
}
