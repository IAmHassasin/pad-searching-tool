/**
 * Attaches `transform_to_ids` (dadguide `transformations.to_monster_id`, ascending) to monster
 * rows. Rows that do not transform get an empty array, so clients can test `length` directly.
 */
export type TransformEdge = { from_monster_id: number; to_monster_id: number };

export function rowMonsterId(row: Record<string, unknown>): number | null {
  const raw = row.monster_id ?? row.__source_pk;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function attachTransformTargets(
  rows: Record<string, unknown>[],
  edges: TransformEdge[]
): Record<string, unknown>[] {
  const targets = new Map<number, number[]>();
  for (const edge of edges) {
    const from = Number(edge.from_monster_id);
    const to = Number(edge.to_monster_id);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= 0) continue;
    const list = targets.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    targets.set(from, list);
  }
  return rows.map((row) => {
    const id = rowMonsterId(row);
    const list = id == null ? [] : [...(targets.get(id) ?? [])].sort((a, b) => a - b);
    return { ...row, transform_to_ids: list };
  });
}
