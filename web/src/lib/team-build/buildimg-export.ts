import type { TeamBuildConfig, TeamMemberConfig } from "./types.ts";

/**
 * Tsubaki `^buildimg` team shorthand.
 *
 * Behaviour of the bot this relies on (TsubakiBotPad/pad-cogs `padbuildimg.py`):
 * - an empty main slot is dropped and later cards shift left, so empty slots use `sdr`
 *   (the delay-buffer placeholder) to keep the 6 positions;
 * - omitted stats default to LV99 / AW9 / +297 on the card, so the level is always written;
 * - the assist slot takes a monster only (no stats), so assist plus / level are not exported;
 * - `SA#` is not exported: `^buildimg 13692|LV120 SA2 +297` crashed the bot ("Error in
 *   command 'padbuildimg'") although our data lists 4 super awakenings for 13692, while the
 *   same card without SA rendered (checked in Discord 2026-11-09);
 * - plus tokens apply in order and `+N` below 297 zeroes all three, so only one plus form
 *   is written per card; per-stat `+H/+A/+R` accept 0..99 only.
 */

/**
 * Tsubaki's per-stat plus cap: it has no ＋限界突破 (+891), so +297 per stat clamps to +99.
 * `+H297` is a parse error in Discord; `+H99 +A0 +R50` renders (checked 2026-11-09).
 */
const BUILDIMG_MAX_PLUS_PER_STAT = 99;

function slotId(raw: string): number | null {
  const id = Number(raw.trim());
  return Number.isInteger(id) && id > 1 ? id : null;
}

function clampPlus(value: number | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(BUILDIMG_MAX_PLUS_PER_STAT, Math.round(n));
}

/** `+297`, `+0`, or `+H## +A## +R##` (each stat clamped to 0..99). */
export function formatBuildImgPlus(hp: number | undefined, atk: number | undefined, rcv: number | undefined): string {
  const h = clampPlus(hp);
  const a = clampPlus(atk);
  const r = clampPlus(rcv);
  const max = BUILDIMG_MAX_PLUS_PER_STAT;
  if (h === max && a === max && r === max) return "+297";
  if (h === 0 && a === 0 && r === 0) return "+0";
  return `+H${h} +A${a} +R${r}`;
}

function formatSlot(member: TeamMemberConfig): string {
  const monsterId = slotId(member.monsterId);
  if (monsterId == null) return "sdr";

  const eqId = slotId(member.eqId);
  // Assist is ID only: Tsubaki looks the whole text inside ( ) up as a monster name, so
  // `(13022|LV120 +297)` fails with "Could not find a monster" (checked in Discord 2026-11-09).
  const assist = eqId == null ? "" : `(${eqId})`;

  const plus = formatBuildImgPlus(member.plusHp, member.plusAtk, member.plusRcv);
  return `${monsterId}${assist}|LV${member.level} ${plus}`;
}

/**
 * `^buildimg` command for one team: leader / 4 subs / helper, monster IDs as card names.
 * Example: ^buildimg 13692(13022)|LV120 +297 / sdr / …
 */
export function exportTeamBuildImgString(config: TeamBuildConfig): string {
  const slots = config.members.map(formatSlot).join(" / ");
  return `^buildimg ${slots}`;
}
