/**
 * Attaches `transform_to_ids` (dadguide `transformations.to_monster_id`, ascending),
 * `transform_from_ids` (the pre-transform forms, `transformations.from_monster_id`, ascending)
 * and `transform_root_id` (first form of the chain, null without a link) to monster rows.
 * Rows without a link get empty arrays, so clients can test `length` directly.
 */
export type TransformEdge = { from_monster_id: number; to_monster_id: number };

export function rowMonsterId(row: Record<string, unknown>): number | null {
  const raw = row.monster_id ?? row.__source_pk;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function addLink(map: Map<number, number[]>, key: number, value: number): void {
  const list = map.get(key) ?? [];
  if (!list.includes(value)) list.push(value);
  map.set(key, list);
}

export function attachTransformTargets(
  rows: Record<string, unknown>[],
  edges: TransformEdge[]
): Record<string, unknown>[] {
  const targets = new Map<number, number[]>();
  const sources = new Map<number, number[]>();
  for (const edge of edges) {
    const from = Number(edge.from_monster_id);
    const to = Number(edge.to_monster_id);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0) continue;
    addLink(targets, from, to);
    addLink(sources, to, from);
  }
  const sorted = (map: Map<number, number[]>, id: number | null) =>
    id == null ? [] : [...(map.get(id) ?? [])].sort((a, b) => a - b);
  return rows.map((row) => {
    const id = rowMonsterId(row);
    return {
      ...row,
      transform_to_ids: sorted(targets, id),
      transform_from_ids: sorted(sources, id),
      transform_root_id: transformChainRoot(id, targets, sources),
    };
  });
}

/**
 * First form of the transform chain a card belongs to (12439 → 12438 → 12437 gives 12437;
 * the root itself gives its own id), or null when the card has no transform link. Walks
 * `sources` (lowest id first), so the edges must include the ancestors — see
 * `MonsterRelationsService.withTransformTargets`.
 */
export function transformChainRoot(
  id: number | null,
  targets: Map<number, number[]>,
  sources: Map<number, number[]>
): number | null {
  if (id == null || (!targets.has(id) && !sources.has(id))) return null;
  const seen = new Set<number>([id]);
  let current = id;
  for (;;) {
    const parents = [...(sources.get(current) ?? [])].sort((a, b) => a - b);
    const next = parents.find((p) => !seen.has(p));
    if (next == null) return current;
    seen.add(next);
    current = next;
  }
}
