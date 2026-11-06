import type { MonsterRecord } from "../../types.ts";
import type { TeamMemberConfig } from "./types.ts";

/** Ids a card transforms into (dadguide `transformations`), ascending; [] when it does not. */
export function transformTargets(row: MonsterRecord | undefined): number[] {
  const raw = row?.transform_to_ids;
  if (!Array.isArray(raw)) return [];
  return raw
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0)
    .sort((a, b) => a - b);
}

/** Slot indexes whose card can transform. */
export function transformableSlots(
  members: TeamMemberConfig[],
  monstersById: ReadonlyMap<number, MonsterRecord>
): number[] {
  const out: number[] = [];
  members.forEach((m, i) => {
    const id = Number(m.monsterId);
    if (id > 0 && transformTargets(monstersById.get(id)).length > 0) out.push(i);
  });
  return out;
}

/**
 * Replaces every transformable card with its first post-transform form. Assist, plus points,
 * role and super awakening are kept; the level restarts at 120 and the page clamps it to the
 * form's cap (transform forms stop at Lv.99). Cards with several forms take the lowest id.
 */
export function transformMembers(
  members: TeamMemberConfig[],
  monstersById: ReadonlyMap<number, MonsterRecord>
): TeamMemberConfig[] {
  return members.map((m) => {
    const id = Number(m.monsterId);
    if (!(id > 0)) return m;
    const [target] = transformTargets(monstersById.get(id));
    if (!target) return m;
    return { ...m, monsterId: String(target), level: 120 };
  });
}
