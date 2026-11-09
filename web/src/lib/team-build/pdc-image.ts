import qrcode from "qrcode-generator";
import type { MonsterRecord } from "../../types.ts";
import { sharesAssistAttribute } from "./assist-bonus.ts";
import {
  pdcMonsterInfoFromRecord,
  pstTeamToPdc,
  type PdcMember,
  type PdcTeam,
} from "./pdc-team-string.ts";
import type { TeamBadgeId, TeamBuildConfig } from "./types.ts";
import { TEAM_SIZE } from "./types.ts";

/**
 * Data for the PDC-style team image: QR code (top-left), badge + title, the team with
 * assists above their cards, then the memo. Title and memo are only drawn — PDC does
 * not put them in the QR. Drawing lives in `pdc-image-render.ts`.
 */

/** Error correction PDC uses: every sample's QR version fits level M, not L. */
export const PDC_QR_ERROR_CORRECTION = "M";
export const PDC_TITLE_MAX_LENGTH = 60;
export const PDC_MEMO_MAX_LENGTH = 400;

export type PdcImageCard = {
  monsterId: number;
  /** `+297`, `+891`, … (sum of the three stats); null = not drawn. */
  plusLabel: string | null;
  /** Null = not drawn (assist whose bonus does not apply, as PDC does). */
  level: number | null;
  /** Super awakening (blue frame) or sync awakening (pink frame); null = none. */
  awakening: { id: number; kind: "super" | "sync" } | null;
};

export type PdcImageSlot = {
  card: PdcImageCard | null;
  assist: PdcImageCard | null;
};

export type PdcImageModel = {
  qrText: string;
  title: string;
  memo: string;
  /** Short text drawn in the badge frame; null = no badge. */
  badgeLabel: string | null;
  slots: PdcImageSlot[];
};

export type PdcImageResult = { model: PdcImageModel; warnings: string[] };

const BADGE_LABEL: Record<TeamBadgeId, string | null> = {
  none: null,
  hp_10: "HP+",
  hp_15: "HP++",
  rcv_50: "RCV+",
  rcv_70: "RCV++",
  atk_10: "ATK+",
  atk_15: "ATK++",
  all_50: "ALL+",
  team_hp_rcv_5: "+5%",
  type_god: "God",
  type_dragon: "Dragon",
  type_devil: "Devil",
  type_machine: "Machine",
  type_balance: "Balance",
  type_attacker: "Attacker",
  type_physical: "Physical",
  type_healer: "Healer",
  collab_base: "Collab",
  collab_plus: "Collab+",
  idol: "Idol",
};

export function pdcBadgeLabel(badge: TeamBadgeId): string | null {
  return Object.hasOwn(BADGE_LABEL, badge) ? BADGE_LABEL[badge] : null;
}

function plusLabel(hp: number, atk: number, rcv: number): string | null {
  const total = hp + atk + rcv;
  return total > 0 ? `+${total}` : null;
}

function cardFromMember(m: PdcMember): PdcImageCard {
  return {
    monsterId: m.monsterId,
    plusLabel: plusLabel(m.plusHp, m.plusAtk, m.plusRcv),
    level: m.level,
    awakening:
      m.superAwakening > 0
        ? { id: m.superAwakening, kind: "super" }
        : m.syncAwakening != null && m.syncAwakening > 0
          ? { id: m.syncAwakening, kind: "sync" }
          : null,
  };
}

/**
 * PDC draws the assist's level and plus only when the assist bonus applies (attributes
 * match, attribute 6 "None" matches all): all 64 assists in the 11 samples follow that,
 * except that 7985 at Lv1 shows "LV1" without its plus. The "None" rule (10864) and the
 * Lv1 rule (7985) rest on one sample each. Without DB rows for both cards the labels
 * are drawn.
 */
function assistFromMember(
  m: PdcMember,
  monstersById: ReadonlyMap<number, MonsterRecord>,
): PdcImageCard | null {
  if (!m.assist) return null;
  const base = monstersById.get(m.monsterId);
  const assist = monstersById.get(m.assist.id);
  const bonusApplies = !base || !assist || sharesAssistAttribute(base, assist);
  return {
    monsterId: m.assist.id,
    plusLabel:
      bonusApplies && m.assist.level > 1
        ? plusLabel(m.assist.plusHp, m.assist.plusAtk, m.assist.plusRcv)
        : null,
    level: bonusApplies ? m.assist.level : null,
    awakening: null,
  };
}

/** Builds the image data; the QR text comes from `pstTeamToPdc` with DB data from the page. */
export function buildPdcImage(
  config: TeamBuildConfig,
  monstersById: ReadonlyMap<number, MonsterRecord>,
  text: { title: string; memo: string },
  /** Team imported from a PDC QR: keeps its latents and assist levels (per matching slot). */
  previous?: PdcTeam,
): PdcImageResult {
  const lookup = (id: number) => {
    const row = monstersById.get(id);
    return row ? pdcMonsterInfoFromRecord(row) : undefined;
  };
  const { team, text: qrText, warnings } = pstTeamToPdc(config, { lookup, previous });
  const bySlot = new Map(team.members.map((m) => [m.slot, m]));
  const slots: PdcImageSlot[] = Array.from({ length: TEAM_SIZE }, (_, slot) => {
    const m = bySlot.get(slot);
    return m ? { card: cardFromMember(m), assist: assistFromMember(m, monstersById) } : { card: null, assist: null };
  });
  return {
    model: {
      qrText,
      title: text.title.trim().slice(0, PDC_TITLE_MAX_LENGTH),
      memo: text.memo.trim().slice(0, PDC_MEMO_MAX_LENGTH),
      badgeLabel: pdcBadgeLabel(config.badge),
      slots,
    },
    warnings,
  };
}

/** QR modules (true = dark) for `text`, at the error correction PDC uses. */
export function pdcQrModules(text: string): boolean[][] {
  const qr = qrcode(0, PDC_QR_ERROR_CORRECTION);
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}
