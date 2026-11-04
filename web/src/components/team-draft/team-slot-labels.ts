import { TEAM_SIZE } from "../../lib/team-build/types";

/** Short slot names in PAD order: Leader · Sub 1–4 · Helper. */
export function teamSlotLabel(index: number): string {
  if (index === 0) return "Leader";
  if (index === TEAM_SIZE - 1) return "Helper";
  return `Sub ${index}`;
}

export const TEAM_SLOT_INDEXES: number[] = Array.from(
  { length: TEAM_SIZE },
  (_, i) => i
);
