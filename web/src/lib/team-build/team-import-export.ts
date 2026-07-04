import type { TeamBuildConfig, TeamMemberConfig } from "./types";
import { TEAM_SIZE } from "./types";

/** PAD team export uses `1` for an empty slot. */
export const EMPTY_SLOT_MARKER = 1;

function isEmptySlotId(id: number): boolean {
  return id <= EMPTY_SLOT_MARKER;
}

type SlotIdField = "monsterId" | "eqId";

function serializeSlotIds(
  members: TeamMemberConfig[],
  field: SlotIdField
): string {
  return members
    .map((m) => {
      const id = Number(m[field].trim());
      if (!Number.isFinite(id) || id <= EMPTY_SLOT_MARKER) {
        return String(EMPTY_SLOT_MARKER);
      }
      return String(id);
    })
    .join(" ");
}

/**
 * Serialize team monster IDs (6 slots: leader | 4 subs | friend leader).
 * Empty slots export as `1`.
 */
export function exportTeamIdString(config: TeamBuildConfig): string {
  return serializeSlotIds(config.members, "monsterId");
}

/** Serialize assist equipment IDs — same slot order and empty marker as monsters. */
export function exportTeamEqString(config: TeamBuildConfig): string {
  return serializeSlotIds(config.members, "eqId");
}

/** Monsters on line 1, equipment on line 2 (when any eq is set). */
export function exportTeamFullString(config: TeamBuildConfig): string {
  const monsters = exportTeamIdString(config);
  const equipment = exportTeamEqString(config);
  const hasEquipment = config.members.some((m) => {
    const id = Number(m.eqId.trim());
    return Number.isFinite(id) && id > EMPTY_SLOT_MARKER;
  });
  if (!hasEquipment) return monsters;
  return `${monsters}\n${equipment}`;
}

function formatTsubakiSlot(member: TeamMemberConfig): string {
  const mid = Number(member.monsterId.trim());
  const eid = Number(member.eqId.trim());
  const monster =
    Number.isFinite(mid) && !isEmptySlotId(mid)
      ? String(mid)
      : String(EMPTY_SLOT_MARKER);
  const hasEq = Number.isFinite(eid) && !isEmptySlotId(eid);
  if (hasEq) return `${monster} (${eid})`;
  return monster;
}

/**
 * Tsubaki `^pdchu` — leader / subs / helper with eq IDs in parentheses.
 * Example: ^pdchu 13692 (13022) / 1 / 13405 (13022) / …
 */
export function exportTeamTsubakiString(config: TeamBuildConfig): string {
  const slots = config.members.map(formatTsubakiSlot).join(" / ");
  return `^pdchu ${slots}`;
}

export type ImportTeamResult = {
  members: TeamMemberConfig[];
  warnings: string[];
};

function parseSlotLine(
  line: string,
  field: SlotIdField,
  baseMembers: TeamMemberConfig[],
  warnings: string[]
): TeamMemberConfig[] {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return baseMembers;

  if (tokens.length !== TEAM_SIZE) {
    warnings.push(
      `Expected ${TEAM_SIZE} ${field === "monsterId" ? "monster" : "equipment"} IDs, got ${tokens.length}.`
    );
  }

  return baseMembers.map((m, i) => {
    const token = tokens[i];
    if (!token) {
      return { ...m, [field]: "" };
    }
    const id = Number(token);
    if (!Number.isFinite(id) || isEmptySlotId(id)) {
      return { ...m, [field]: "" };
    }
    return { ...m, [field]: String(id) };
  });
}

/**
 * Parse team import text.
 * Line 1: monster IDs. Optional line 2: equipment IDs (same format).
 * Preserves role, level, and other fields from `base` members.
 */
export function importTeamIdString(
  raw: string,
  baseMembers: TeamMemberConfig[]
): ImportTeamResult {
  const lines = raw
    .trim()
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const warnings: string[] = [];

  if (lines.length === 0) {
    return { members: baseMembers, warnings: ["No IDs in import string."] };
  }

  let members = parseSlotLine(lines[0], "monsterId", baseMembers, warnings);
  if (lines.length >= 2) {
    members = parseSlotLine(lines[1], "eqId", members, warnings);
  }

  return { members, warnings };
}
