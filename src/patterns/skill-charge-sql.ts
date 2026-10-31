/**
 * Skill Charge (51) adds +1 charge per turn. Skill Charge+ (97) adds +2.
 * The natural tick is already 1, so charges per turn are 1 + those bonuses.
 * A 10-turn skill with one 51 is ready in ceil(10/2) = 5 turns.
 *
 * Regular copies and the sync awakening all stack. Super awakenings are a
 * choice of one, so only the stronger skill-charge option counts.
 */

const SKILL_CHARGE_ID = 51;
const SKILL_CHARGE_PLUS_ID = 97;

/** Count of `(id)` tokens in a dadguide awakening text expression. `id` is a fixed awakening id. */
export function awakeningIdCountSql(id: number, textExpr: string): string {
  if (!Number.isInteger(id) || id < 0) {
    throw new Error(`Invalid awakening id: ${id}`);
  }
  const token = `(${id})`;
  return (
    `(LENGTH(COALESCE(${textExpr}, '')) - ` +
    `LENGTH(REPLACE(COALESCE(${textExpr}, ''), '${token}', ''))) / ${token.length}`
  );
}

/**
 * Turns of skill charge gained each player turn, including the natural 1.
 * `regularExpr` / `superExpr` are awakening text; `syncExpr` is one awakening id.
 */
export function skillChargeChargesPerTurnSql(
  regularExpr: string,
  superExpr: string,
  syncExpr: string
): string {
  const regular =
    `(${awakeningIdCountSql(SKILL_CHARGE_ID, regularExpr)} + ` +
    `2 * ${awakeningIdCountSql(SKILL_CHARGE_PLUS_ID, regularExpr)})`;
  const sync =
    `(CASE WHEN ${syncExpr} = ${SKILL_CHARGE_ID} THEN 1 ` +
    `WHEN ${syncExpr} = ${SKILL_CHARGE_PLUS_ID} THEN 2 ELSE 0 END)`;
  const superBonus =
    `(CASE WHEN ${awakeningIdCountSql(SKILL_CHARGE_PLUS_ID, superExpr)} > 0 THEN 2 ` +
    `WHEN ${awakeningIdCountSql(SKILL_CHARGE_ID, superExpr)} > 0 THEN 1 ELSE 0 END)`;
  return `(1 + ${regular} + ${sync} + ${superBonus})`;
}

/** Turns until the skill is ready. Null when cooldown or charges are not usable. */
export function effectiveSkillCooldown(
  cooldown: number,
  chargesPerTurn: number
): number | null {
  if (!Number.isFinite(cooldown) || cooldown <= 0) return null;
  if (!Number.isFinite(chargesPerTurn) || chargesPerTurn <= 0) return null;
  return Math.ceil(cooldown / chargesPerTurn);
}

/**
 * The effect can be kept up when its duration is at least the effective
 * cooldown. A 5-turn buff loops a 5-turn stage; a 3-turn buff does not.
 */
export function effectDurationLoops(
  turns: number | null,
  cooldown: unknown,
  chargesPerTurn: unknown
): boolean {
  if (turns == null || !Number.isFinite(turns)) return false;
  const cd = typeof cooldown === "number" ? cooldown : Number(cooldown);
  const charges =
    typeof chargesPerTurn === "number" ? chargesPerTurn : Number(chargesPerTurn);
  const effective = effectiveSkillCooldown(cd, charges);
  return effective != null && turns >= effective;
}

const STAGE_MARKER = /\d+\)\s/g;

function parseStageCooldowns(raw: unknown): number[] {
  if (raw == null) return [];
  const text = String(raw).trim();
  if (!text) return [];
  const out: number[] = [];
  for (const part of text.split(",")) {
    const n = Number(part.trim());
    out.push(Number.isFinite(n) && n > 0 ? n : 0);
  }
  return out.some((n) => n > 0) ? out : [];
}

/**
 * Cooldown of the evolving-skill stage that contains `matchIndex`.
 * Stage 1 uses the skilled parent cooldown. Later stages use their own
 * max-level cooldown from `stageCooldowns` (`"26,5"` → stage 2 is 5).
 */
export function stageCooldownAt(
  text: string,
  matchIndex: number,
  parentCooldown: unknown,
  stageCooldowns: unknown
): unknown {
  const cds = parseStageCooldowns(stageCooldowns);
  if (!cds.length || matchIndex < 0) return parentCooldown;
  let markers = 0;
  STAGE_MARKER.lastIndex = 0;
  for (;;) {
    const marker = STAGE_MARKER.exec(text);
    if (!marker || marker.index >= matchIndex) break;
    markers += 1;
    if (marker[0].length === 0) STAGE_MARKER.lastIndex += 1;
  }
  if (markers <= 1) return parentCooldown;
  const stageCd = cds[markers - 1];
  return stageCd != null && stageCd > 0 ? stageCd : parentCooldown;
}
