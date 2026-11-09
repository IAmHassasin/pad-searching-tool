import type { MonsterRecord } from "../../types.ts";
import { maxMonsterLevel } from "./level-scaling.ts";
import {
  PLUS_PER_STAT_BEFORE_LIMIT_BREAK,
  PLUS_PER_STAT_CAP,
} from "./stat-reference.ts";
import type { TeamMemberConfig } from "./types.ts";

/** +297 per stat (+891) on the card: the ＋限界突破 cap. */
export const MAX_PLUS = PLUS_PER_STAT_CAP;
/**
 * +99 per stat (+297) on the assist: limit-break plus is not counted in the assist
 * bonus, so going higher would change no number.
 */
export const MAX_ASSIST_PLUS = PLUS_PER_STAT_BEFORE_LIMIT_BREAK;

/**
 * Every filled slot at its highest level (Lv.120 / 110 by limit break, Lv.99 for transform
 * forms) with +891 on the card and +297 on its assist. Empty slots are untouched. A monster
 * whose record has not arrived yet gets Lv.120; the page clamps it to the real cap once the
 * record loads, so a click during a refetch still ends at the maximum.
 */
export function maxOutMembers(
  members: TeamMemberConfig[],
  monstersById: ReadonlyMap<number, MonsterRecord>
): TeamMemberConfig[] {
  return members.map((m) => {
    const id = Number(m.monsterId);
    if (!Number.isFinite(id) || id <= 0) return m;
    const row = monstersById.get(id);
    const level = row ? maxMonsterLevel(row) : 120;
    const next: TeamMemberConfig = {
      ...m,
      level,
      plusHp: MAX_PLUS,
      plusAtk: MAX_PLUS,
      plusRcv: MAX_PLUS,
      eqPlusHp: MAX_ASSIST_PLUS,
      eqPlusAtk: MAX_ASSIST_PLUS,
      eqPlusRcv: MAX_ASSIST_PLUS,
    };
    const same =
      next.level === m.level &&
      m.plusHp === MAX_PLUS &&
      m.plusAtk === MAX_PLUS &&
      m.plusRcv === MAX_PLUS &&
      m.eqPlusHp === MAX_ASSIST_PLUS &&
      m.eqPlusAtk === MAX_ASSIST_PLUS &&
      m.eqPlusRcv === MAX_ASSIST_PLUS;
    return same ? m : next;
  });
}
