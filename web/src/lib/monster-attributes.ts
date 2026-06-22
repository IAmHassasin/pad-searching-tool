import type { MonsterRecord } from "../types";

/** dadguide `d_attributes` + sprite column (rows 0–6). */
export const MONSTER_ATTRIBUTES = [
  { id: 0, label: "Fire" },
  { id: 1, label: "Water" },
  { id: 2, label: "Wood" },
  { id: 3, label: "Light" },
  { id: 4, label: "Dark" },
  { id: 5, label: "Heart" },
  { id: 6, label: "None" },
] as const;

export type AttributeSlotFilters = [Set<number>, Set<number>, Set<number>];

export const EMPTY_ATTRIBUTE_SLOTS: AttributeSlotFilters = [
  new Set(),
  new Set(),
  new Set(),
];

const LABEL_BY_ID = new Map(MONSTER_ATTRIBUTES.map((a) => [a.id, a.label]));

export function monsterAttributeLabel(attributeId: number): string {
  return LABEL_BY_ID.get(attributeId) ?? `Attr ${attributeId}`;
}

export function parseMonsterAttributeIds(
  row: Pick<
    MonsterRecord,
    "attribute_1_id" | "attribute_2_id" | "attribute_3_id"
  >
): number[] {
  const out: number[] = [];
  for (const id of [
    row.attribute_1_id,
    row.attribute_2_id,
    row.attribute_3_id,
  ]) {
    if (id == null || !Number.isFinite(id)) continue;
    out.push(id);
  }
  return out;
}

export function hasAttributeSlotFilters(slots: AttributeSlotFilters): boolean {
  return slots.some((s) => s.size > 0);
}

export function toggleAttributeSlot(
  slots: AttributeSlotFilters,
  slotIndex: number,
  attributeId: number
): AttributeSlotFilters {
  const next = slots.map((s) => new Set(s)) as AttributeSlotFilters;
  const slot = next[slotIndex];
  if (slot.has(attributeId)) slot.delete(attributeId);
  else slot.add(attributeId);
  return next;
}
