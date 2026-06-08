import type { MonsterRecord } from "../types";

export function monsterRowId(row: MonsterRecord): number {
  const id = row.monster_id ?? row.__source_pk;
  return typeof id === "number" ? id : Number(id);
}
