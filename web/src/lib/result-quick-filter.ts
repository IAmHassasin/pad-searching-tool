import { monsterHasAwakening } from "./awakenings";
import { ASSIST_EQUIPMENT_AWAKENING_ID } from "./monster-search-url";
import { monsterHasMaterialType } from "./monster-types";
import type { MonsterRecord } from "../types";

export type ResultQuickFilter = "monster" | "eq" | null;

export function passesResultQuickFilter(
  row: MonsterRecord,
  filter: ResultQuickFilter
): boolean {
  if (!filter) return true;

  const hasAwk49 = monsterHasAwakening(row, ASSIST_EQUIPMENT_AWAKENING_ID);

  if (filter === "eq") return hasAwk49;

  return !hasAwk49 && !monsterHasMaterialType(row);
}

export function filterRowsByQuickFilter(
  rows: MonsterRecord[],
  filter: ResultQuickFilter
): MonsterRecord[] {
  if (!filter) return rows;
  return rows.filter((row) => passesResultQuickFilter(row, filter));
}
