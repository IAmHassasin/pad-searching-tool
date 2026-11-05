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
    filters.hpMin != null ||
    filters.hpMax != null ||
    filters.atkMin != null ||
    filters.atkMax != null ||
    filters.rcvMin != null ||
    filters.rcvMax != null ||
    filters.idQuery.trim().length > 0 ||
    filters.awakeningIds.length > 0 ||
    filters.excludedAwakeningIds.length > 0 ||
    filters.vanishOnly ||
    filters.vanishAwakeningIds.length > 0
  );
}
