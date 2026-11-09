import type { MonsterRecord } from "../../types.ts";
import type { TeamMemberConfig } from "./types.ts";

function linkedIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0)
    .sort((a, b) => a - b);
}

/** Ids a card transforms into (dadguide `transformations`), ascending; [] when it does not. */
export function transformTargets(row: MonsterRecord | undefined): number[] {
  return linkedIds(row?.transform_to_ids);
}

/** Pre-transform ids a post-transform card comes from, ascending; [] when it has none. */
export function transformSources(row: MonsterRecord | undefined): number[] {
  return linkedIds(row?.transform_from_ids);
}

function slotsWith(
  members: TeamMemberConfig[],
  monstersById: ReadonlyMap<number, MonsterRecord>,
  links: (row: MonsterRecord | undefined) => number[]
): number[] {
  const out: number[] = [];
  members.forEach((m, i) => {
    const id = Number(m.monsterId);
    if (id > 0 && links(monstersById.get(id)).length > 0) out.push(i);
  });
  return out;
}

function swapMembers(
  members: TeamMemberConfig[],
  monstersById: ReadonlyMap<number, MonsterRecord>,
  links: (row: MonsterRecord | undefined) => number[]
): TeamMemberConfig[] {
  return members.map((m) => {
    const id = Number(m.monsterId);
    if (!(id > 0)) return m;
    const [next] = links(monstersById.get(id));
    if (!next) return m;
    return { ...m, monsterId: String(next), level: 120 };
  });
}

/** Slot indexes whose card can transform. */
export function transformableSlots(
  members: TeamMemberConfig[],
  monstersById: ReadonlyMap<number, MonsterRecord>
): number[] {
  return slotsWith(members, monstersById, transformTargets);
}

/** Slot indexes holding a post-transform card that can go back to its pre-transform form. */
export function detransformableSlots(
  members: TeamMemberConfig[],
  monstersById: ReadonlyMap<number, MonsterRecord>
): number[] {
  return slotsWith(members, monstersById, transformSources);
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
  return swapMembers(members, monstersById, transformTargets);
}

/**
 * Reverse of `transformMembers`: every post-transform card goes back to its pre-transform
 * form (lowest id when several forms lead to it). Assist, plus points, role and super
 * awakening are kept; the level restarts at 120 and the page clamps it to the form's cap.
 */
export function detransformMembers(
  members: TeamMemberConfig[],
  monstersById: ReadonlyMap<number, MonsterRecord>
): TeamMemberConfig[] {
  return swapMembers(members, monstersById, transformSources);
}
