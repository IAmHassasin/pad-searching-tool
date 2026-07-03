import type { TeamBuildConfig, TeamMemberConfig } from "./types";
import { TEAM_SIZE } from "./types";

/** PAD team export uses `1` for an empty slot. */
export const EMPTY_SLOT_MARKER = 1;

function isEmptySlotId(id: number): boolean {
  return id <= EMPTY_SLOT_MARKER;
}

/**
 * Serialize team monster IDs (6 slots: leader | 4 subs | friend leader).
 * Empty slots export as `1`.
 */
export function exportTeamIdString(config: TeamBuildConfig): string {
  return config.members
    .map((m) => {
      const id = Number(m.monsterId.trim());
      if (!Number.isFinite(id) || id <= EMPTY_SLOT_MARKER) {
        return String(EMPTY_SLOT_MARKER);
      }
      return String(id);
    })
    .join(" ");
}

export type ImportTeamResult = {
  members: TeamMemberConfig[];
  warnings: string[];
};

/**
 * Parse a space-separated team ID string into member configs.
 * Preserves role, level, latents, and eq from `base` members.
 */
export function importTeamIdString(
  raw: string,
  baseMembers: TeamMemberConfig[]
): ImportTeamResult {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const warnings: string[] = [];

  if (tokens.length === 0) {
    return { members: baseMembers, warnings: ["No IDs in import string."] };
  }
  if (tokens.length !== TEAM_SIZE) {
    warnings.push(
      `Expected ${TEAM_SIZE} IDs, got ${tokens.length}. Extra tokens are ignored; missing slots stay empty.`
    );
  }

  const members = baseMembers.map((m, i) => {
    const token = tokens[i];
    if (!token) {
      return { ...m, monsterId: "" };
    }
    const id = Number(token);
    if (!Number.isFinite(id) || isEmptySlotId(id)) {
      return { ...m, monsterId: "" };
    }
    return { ...m, monsterId: String(id) };
  });

  return { members, warnings };
}
