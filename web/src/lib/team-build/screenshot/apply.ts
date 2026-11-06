import type { TeamMemberConfig } from "../types.ts";

/**
 * What the user confirmed for one slot. `undefined` keeps the current value, `null` empties it.
 */
export type SlotSelection = {
  slotIndex: number;
  monsterId?: number | null;
  eqId?: number | null;
};

function idString(id: number | null): string {
  return id != null && Number.isInteger(id) && id > 1 ? String(id) : "";
}

/**
 * Returns new members with the confirmed ids applied. Plus points, role and super awakening are
 * kept; a slot that receives a different monster restarts at Lv.120 (the page clamps it to the
 * card's real cap once its record is loaded), because the previous card's level is meaningless
 * for the new one.
 */
export function applyScreenshotSelections(
  members: TeamMemberConfig[],
  selections: SlotSelection[]
): TeamMemberConfig[] {
  const bySlot = new Map(selections.map((s) => [s.slotIndex, s]));
  return members.map((member, i) => {
    const sel = bySlot.get(i);
    if (!sel) return member;
    const next = { ...member };
    if (sel.monsterId !== undefined) {
      next.monsterId = idString(sel.monsterId);
      if (next.monsterId && next.monsterId !== member.monsterId) next.level = 120;
    }
    if (sel.eqId !== undefined) next.eqId = idString(sel.eqId);
    return next;
  });
}
