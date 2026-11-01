import type { MonsterRecord } from "../types";

/**
 * One-sided leader skill eHP multiplier: HP mult / (1 - damage reduction).
 * Returns null when the row has no leader skill stat data.
 */
export function leaderSkillEhp(row: MonsterRecord): number | null {
  const hp = row.leader_skill_max_hp;
  if (hp == null || !Number.isFinite(Number(hp))) return null;
  const shield = Number(row.leader_skill_max_shield ?? 0);
  if (!Number.isFinite(shield) || shield >= 1) return null;
  return Number(hp) / (1 - Math.max(0, shield));
}

/** Display form, e.g. "5.6x"; "—" when unknown. */
export function formatLeaderSkillEhp(row: MonsterRecord): string {
  const ehp = leaderSkillEhp(row);
  if (ehp == null) return "—";
  return `${Number(ehp.toFixed(2))}x`;
}
