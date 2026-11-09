import type { MonsterRecord } from "../../types.ts";
import { clampMonsterLevel } from "./level-scaling.ts";
import type { TeamBuildConfig, TeamMemberConfig } from "./types.ts";

/**
 * Layout of the team image (Tsubaki `^buildimg` style): one row of cards
 * (leader · 4 subs · helper) with the assists drawn above their card. Pure data so the
 * geometry and labels can be unit-tested; drawing lives in `team-image-render.ts`.
 */

/** CDN icons are 100×100 with the in-game attribute frame. */
export const TEAM_IMAGE_ICON_PX = 100;
/** Gap between neighbouring cards. */
export const TEAM_IMAGE_GAP_PX = 6;
/** Extra space that separates the leader and the helper from the subs. */
export const TEAM_IMAGE_LEADER_GAP_PX = 18;
/** Gap between the assist row and the card row. */
export const TEAM_IMAGE_ROW_GAP_PX = 6;

export type TeamImagePlusLabel =
  | { kind: "none" }
  | { kind: "total"; text: string }
  | { kind: "perStat"; lines: [string, string, string] };

export type TeamImageCard = {
  monsterId: number;
  x: number;
  y: number;
  /** Lv. label, clamped to what the card can reach (e.g. Lv.99 without limit break). */
  level: number | null;
  plus: TeamImagePlusLabel;
  /** Active super awakening drawn in the corner; null = none. */
  superAwakeningId: number | null;
};

export type TeamImageAssist = { monsterId: number; x: number; y: number };

export type TeamImageSlot = {
  index: number;
  x: number;
  /** Null for an empty slot (drawn as a placeholder). */
  card: TeamImageCard | null;
  assist: TeamImageAssist | null;
};

export type TeamImageLayout = {
  width: number;
  height: number;
  iconPx: number;
  cardRowY: number;
  slots: TeamImageSlot[];
};

export type TeamImageMonsterLookup = (id: number) => MonsterRecord | null | undefined;

function slotId(raw: string): number | null {
  const id = Number(raw.trim());
  return Number.isInteger(id) && id > 1 ? id : null;
}

function plusPoints(value: number | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * `+297` / `+891` when all three stats share the same cap, nothing at +0 (as Tsubaki),
 * otherwise one line per stat. Unlike the `^buildimg` command, +891 is shown as is.
 */
export function teamImagePlusLabel(member: TeamMemberConfig): TeamImagePlusLabel {
  const h = plusPoints(member.plusHp);
  const a = plusPoints(member.plusAtk);
  const r = plusPoints(member.plusRcv);
  if (h === 0 && a === 0 && r === 0) return { kind: "none" };
  if (h === a && a === r && (h === 99 || h === 297)) return { kind: "total", text: `+${h * 3}` };
  return { kind: "perStat", lines: [`+${h} HP`, `+${a} ATK`, `+${r} RCV`] };
}

function slotX(index: number): number {
  const stride = TEAM_IMAGE_ICON_PX + TEAM_IMAGE_GAP_PX;
  let x = index * stride;
  if (index >= 1) x += TEAM_IMAGE_LEADER_GAP_PX;
  if (index >= 5) x += TEAM_IMAGE_LEADER_GAP_PX;
  return x;
}

export function buildTeamImageLayout(
  members: TeamBuildConfig["members"],
  lookup: TeamImageMonsterLookup
): TeamImageLayout {
  const icon = TEAM_IMAGE_ICON_PX;
  const hasAssist = members.some((m) => slotId(m.monsterId) != null && slotId(m.eqId) != null);
  const cardRowY = hasAssist ? icon + TEAM_IMAGE_ROW_GAP_PX : 0;

  const slots: TeamImageSlot[] = members.map((member, index) => {
    const x = slotX(index);
    const monsterId = slotId(member.monsterId);
    if (monsterId == null) return { index, x, card: null, assist: null };

    const row = lookup(monsterId);
    const eqId = slotId(member.eqId);
    return {
      index,
      x,
      card: {
        monsterId,
        x,
        y: cardRowY,
        level: row ? clampMonsterLevel(row, member.level) : member.level,
        plus: teamImagePlusLabel(member),
        superAwakeningId: member.selectedSuperAwakening,
      },
      assist: eqId == null ? null : { monsterId: eqId, x, y: 0 },
    };
  });

  return {
    width: slotX(members.length - 1) + icon,
    height: cardRowY + icon,
    iconPx: icon,
    cardRowY,
    slots,
  };
}
