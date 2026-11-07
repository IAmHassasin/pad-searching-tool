import type { MonsterFilters, MonsterRecord } from "../types.ts";
import { hasAttributeSlotFilters } from "./monster-attributes.ts";

export function monsterRowId(row: MonsterRecord): number {
  const id = row.monster_id ?? row.__source_pk;
  return typeof id === "number" ? id : Number(id);
}

export function hasActiveMonsterFilters(filters: MonsterFilters): boolean {
  return (
    filters.rarity.size > 0 ||
    hasAttributeSlotFilters(filters.attributeSlots) ||
    filters.types.size > 0 ||
    filters.idQuery.trim().length > 0 ||
    filters.awakeningIds.length > 0 ||
    filters.excludedAwakeningIds.length > 0 ||
    filters.vanishOnly ||
    filters.vanishAwakeningIds.length > 0
  );
}

/**
 * Number of active quick-chip filters (Rarity / Attribute / Type), each
 * counted once however many values it holds — drives the mobile header
 * badge and the "n active" chip summaries.
 */
export function countMonsterChipFilters(filters: MonsterFilters): number {
  return (
    (filters.rarity.size > 0 ? 1 : 0) +
    (hasAttributeSlotFilters(filters.attributeSlots) ? 1 : 0) +
    (filters.types.size > 0 ? 1 : 0)
  );
}
