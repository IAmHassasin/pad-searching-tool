import type { MonsterRecord } from "../types";

/** dadguide `d_types` — monster type slots (type_1_id … type_3_id). */
export const MONSTER_TYPES = [
  { id: 5, label: "God", accent: "#d29922" },
  { id: 4, label: "Dragon", accent: "#db6d28" },
  { id: 7, label: "Devil", accent: "#a371f7" },
  { id: 8, label: "Machine", accent: "#58a6ff" },
  { id: 1, label: "Balance", accent: "#d29922" },
  { id: 6, label: "Attacker", accent: "#f778ba" },
  { id: 2, label: "Physical", accent: "#f85149" },
  { id: 3, label: "Healer", accent: "#3fb950" },
  { id: 0, label: "Evo Mats", accent: "#8b949e" },
  { id: 12, label: "Awoken Mats", accent: "#39c5cf" },
  { id: 14, label: "Enhance Mats", accent: "#8b949e" },
  { id: 15, label: "Redeemable Mats", accent: "#6e7681" },
] as const;

const TYPE_LABEL_BY_ID = new Map(MONSTER_TYPES.map((t) => [t.id, t.label]));

/** type_1 → type_2 → type_3, deduped, nulls skipped. */
export function parseMonsterTypeIds(
  row: Pick<MonsterRecord, "type_1_id" | "type_2_id" | "type_3_id">
): number[] {
  const out: number[] = [];
  for (const id of [row.type_1_id, row.type_2_id, row.type_3_id]) {
    if (id == null || !Number.isFinite(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function monsterTypeLabel(typeId: number): string {
  return TYPE_LABEL_BY_ID.get(typeId) ?? `Type ${typeId}`;
}
