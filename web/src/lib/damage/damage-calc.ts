/**
 * PAD damage pipeline (feth v20.4 sheet, 2023-01-21) with the awakening
 * values from `./awakening-multipliers`.
 *
 * Pipeline:
 * 1. Per match: ATK × orb-count factor × enhanced-orb factor × shape
 *    awakenings × sub-attribute factor × skill / debuff multipliers.
 * 2. Sub-total: Σ matches × row enhance × combo boosts × blob × colour boost
 *    × attribute combo enhance × HP-side × L-heal × blessings × combo count
 *    × leader skill → capped.
 * 3. Actual: (sub-total × killers × attribute advantage − DEF) × enemy
 *    passive → capped.
 *
 * Pure TypeScript — no React, no DOM.
 */
import {
  AWAKENING_MULTIPLIERS,
  KILLER_LATENT_ATK,
  KILLER_TARGET_TYPE,
  MATERIAL_KILLER_CAP_MULT,
  TYPE_KILLER_CAP_MULT,
  type AwakeningMultiplierDef,
} from "./awakening-multipliers.ts";

/** Per-attribute damage cap: 2^31 − 1. */
export const DAMAGE_CAP = 2_147_483_647;
/** Expanded damage cap (damage-cap-release effects): 2 × (2^31 − 1). */
export const DAMAGE_CAP_EXPANDED = 4_294_967_294;

/**
 * Cap multipliers never stack: the single highest applicable one wins
 * (type killer ×2, material killer ×1.2, latent release ×5 / ×10, skills).
 */
export function damageCapFor(capMultiplier: number): number {
  const mult = Number.isFinite(capMultiplier) && capMultiplier > 1 ? capMultiplier : 1;
  return Math.floor(DAMAGE_CAP * mult);
}

/** Attribute ids: 0 fire, 1 water, 2 wood, 3 light, 4 dark, 5 heal. */
export const HEAL_ATTRIBUTE = 5;

export type MatchShape = "vdp" | "l" | "cross" | "t" | "column";

/** One orb match (combo) on the board. */
export type DamageMatchInput = {
  /** Orb attribute id (0–4 colours, 5 heal, 6 jammer, 7 poison). */
  attribute: number;
  /** Number of orbs in the match (≥ 3). */
  orbs: number;
  /** Enhanced orbs inside the match. Default 0. */
  enhancedOrbs?: number;
  /** Special shape of the match, if any. TPA is implied by exactly 4 orbs. */
  shape?: MatchShape | null;
  /** True when the match is a full row (6 orbs on 6×5). Default false. */
  isRow?: boolean;
};

export const JAMMER_ATTRIBUTE = 6;
export const POISON_ATTRIBUTE = 7;

/** The attacking card. */
export type DamageCardInput = {
  /** ATK used for the attack (after stat multipliers / +points). */
  atk: number;
  /** Main attribute id (0–4). */
  mainAttribute: number;
  /** Sub attribute id (0–4) or null. */
  subAttribute?: number | null;
  /** Which attribute slot is attacking. Default "main". */
  slot?: "main" | "sub";
  /** Active awakening ids on this card (regular + super; duplicates count). */
  awakenings: number[];
  /** Number of killer latent awakenings matching the enemy. Default 0. */
  matchedKillerLatents?: number;
  /** Current HP ratio (0–1) for 57 / 58. Default 1. */
  hpRatio?: number;
};

/** Board / turn context. */
export type DamageBoardInput = {
  matches: DamageMatchInput[];
  /** Total combo count. Default `matches.length`. */
  combos?: number;
  /** Awakening ids on the whole team (incl. this card, duplicates count). Used for team-wide awakenings (row / combo / orb enhance). Default = card awakenings. */
  teamAwakenings?: number[];
  /** Per-match multiplier from active skills (e.g. ×2 ATK buffs). Default 1. */
  skillMultiplier?: number;
  /** Per-match multiplier from enemy debuffs on the team. Default 1. */
  debuffMultiplier?: number;
  /** Leader-skill ATK multiplier for this card. Default 1. */
  leaderMultiplier?: number;
  /** True inside a super-gravity dungeon (enables 106). Default false. */
  superGravity?: boolean;
  /** Current floor (enables 143). Default 1. */
  floor?: number;
  /** Puzzle time in seconds (141 needs ≤ 5). Default null = unknown. */
  puzzleTimeSeconds?: number | null;
};

export type DamageEnemyInput = {
  /** Enemy attribute id (0–4) for attribute advantage. Null = neutral. */
  attribute?: number | null;
  /** Enemy type ids for killer matching. Default []. */
  types?: number[];
  /** Enemy DEF. Default 0. */
  defense?: number;
  /** Passive multiplier (type / attribute resists ×0.5, active shields…). Default 1. */
  passiveMultiplier?: number;
  /** True when the damage cap is expanded (×2). Default false. */
  expandedCap?: boolean;
  /**
   * Explicit cap multiplier from latents / skills (×5 release latent, ×10,
   * skill caps expressed as a multiple of the base cap). Default 1.
   */
  capMultiplier?: number;
};

export type CardDamageInput = {
  card: DamageCardInput;
  board: DamageBoardInput;
  enemy?: DamageEnemyInput;
};

export type CardDamageResult = {
  /** Damage added by each match of the attacking attribute (in board order). */
  perMatch: number[];
  /** Sub-total before the cap. */
  subtotal: number;
  /** Sub-total after the cap — the number shown on the card. */
  subtotalCapped: number;
  afterKiller: number;
  afterAttribute: number;
  afterDefense: number;
  /** Final damage shown on the enemy. */
  actual: number;
  /** True when any step was truncated by the cap. */
  capped: boolean;
  expandedCap: boolean;
  /** Cap applied to this attack (base cap × highest applicable multiplier). */
  damageCap: number;
  /** Flat bonus damage dealt after the attack (45 / 50). */
  fixedBonusDamage: number;
};

export function capDamage(value: number, expanded = false): number {
  const cap = expanded ? DAMAGE_CAP_EXPANDED : DAMAGE_CAP;
  return value > cap ? cap : value;
}

function capAt(value: number, cap: number): number {
  return value > cap ? cap : value;
}

/** 1 + 0.25 × (orbs − 3); fewer than 3 orbs is treated as 3. */
export function orbCountFactor(orbs: number): number {
  const n = Math.max(3, Math.floor(orbs));
  return 1 + 0.25 * (n - 3);
}

/** ×2 for weakness, ×0.5 when resisted, ×1 otherwise. */
export function attributeAdvantage(
  attacker: number,
  defender: number | null | undefined
): number {
  if (defender == null || defender < 0 || defender > 4) return 1;
  if (attacker === 3 && defender === 4) return 2;
  if (attacker === 4 && defender === 3) return 2;
  if (attacker === 3 || attacker === 4 || defender === 3 || defender === 4) {
    return 1;
  }
  // Fire(0) > Wood(2) > Water(1) > Fire(0)
  const beats: Record<number, number> = { 0: 2, 2: 1, 1: 0 };
  if (beats[attacker] === defender) return 2;
  if (beats[defender] === attacker) return 0.5;
  return 1;
}

function countId(ids: number[], id: number): number {
  let n = 0;
  for (const x of ids) if (x === id) n += 1;
  return n;
}

function defsOf(ids: number[]): AwakeningMultiplierDef[] {
  const out: AwakeningMultiplierDef[] = [];
  for (const id of ids) {
    const def = AWAKENING_MULTIPLIERS[id];
    if (def) out.push(def);
  }
  return out;
}

/** Multiplier contributed by `match`-kind awakenings for one match. */
function shapeMultiplier(
  match: DamageMatchInput,
  cardAwakenings: number[]
): number {
  let mult = 1;
  const tpa = match.orbs === 4;
  for (const def of defsOf(cardAwakenings)) {
    if (def.kind !== "match") continue;
    const atk = def.atk ?? 1;
    if (def.id === 27 || def.id === 96) {
      if (tpa) mult *= atk;
      continue;
    }
    if (def.id === 48 || def.id === 109) {
      if (match.shape === "vdp") mult *= atk;
      continue;
    }
    if (def.id === 60 || def.id === 108) {
      if (match.shape === "l") mult *= atk;
      continue;
    }
    if (def.id === 78 || def.id === 110) {
      if (match.shape === "cross") mult *= atk;
      continue;
    }
    if (def.id === 126) {
      if (match.shape === "t") mult *= atk;
      continue;
    }
    if (def.attribute != null && def.id >= 149 && def.id <= 153) {
      if (match.shape === "column" && match.attribute === def.attribute) {
        mult *= atk;
      }
    }
  }
  return mult;
}

/** (1 + 0.06 × enhanced orbs) × (1 + Σ perUnit of team orb-enhance awakenings). */
function enhancedOrbFactor(
  match: DamageMatchInput,
  teamAwakenings: number[]
): number {
  const enhanced = Math.max(0, match.enhancedOrbs ?? 0);
  if (enhanced <= 0) return 1;
  let team = 0;
  for (const def of defsOf(teamAwakenings)) {
    if (def.kind === "orb-enhance" && def.attribute === match.attribute) {
      team += def.perUnit ?? 0;
    }
  }
  return (1 + 0.06 * enhanced) * (1 + team);
}

/**
 * Damage of one match for the attacking attribute. Returns 0 for matches of
 * other attributes (they do not add to this slot).
 */
export function computeMatchDamage(
  match: DamageMatchInput,
  input: CardDamageInput
): number {
  const { card, board } = input;
  const slot = card.slot ?? "main";
  const attacking =
    slot === "sub" ? card.subAttribute ?? null : card.mainAttribute;
  if (attacking == null || match.attribute !== attacking) return 0;

  const teamAwakenings = board.teamAwakenings ?? card.awakenings;
  let d = card.atk * orbCountFactor(match.orbs);
  d *= enhancedOrbFactor(match, teamAwakenings);
  d *= shapeMultiplier(match, card.awakenings);
  if (slot === "sub") {
    d *= card.subAttribute === card.mainAttribute ? 0.1 : 1 / 3;
  }
  d *= board.skillMultiplier ?? 1;
  d *= board.debuffMultiplier ?? 1;
  return d;
}

/** 1 + Σ(perUnit × count) × rows matched, for the attacking attribute. */
function rowEnhanceFactor(
  attacking: number,
  matches: DamageMatchInput[],
  teamAwakenings: number[]
): number {
  const rows = matches.filter(
    (m) => m.attribute === attacking && m.isRow === true
  ).length;
  if (rows <= 0) return 1;
  let perRow = 0;
  for (const def of defsOf(teamAwakenings)) {
    if (def.kind === "row" && def.attribute === attacking) {
      perRow += def.perUnit ?? 0;
    }
  }
  return 1 + perRow * rows;
}

/** 1 + Σ(perUnit × count) × (matches − 1) when ≥ 2 matches of the attribute. */
function comboEnhanceFactor(
  attacking: number,
  matches: DamageMatchInput[],
  teamAwakenings: number[]
): number {
  const n = matches.filter((m) => m.attribute === attacking).length;
  if (n < 2) return 1;
  let per = 0;
  for (const def of defsOf(teamAwakenings)) {
    if (def.kind === "combo-enhance" && def.attribute === attacking) {
      per += def.perUnit ?? 0;
    }
  }
  return 1 + per * (n - 1);
}

function comboBoostFor(id: number, combos: number): number | null {
  switch (id) {
    case 43:
      return combos >= 14 ? 3 : combos >= 7 ? 2 : null;
    case 107:
      return combos >= 14 ? 9 : combos >= 7 ? 4 : null;
    case 61:
      return combos >= 10 ? 5 : null;
    case 111:
      return combos >= 10 ? 25 : null;
    case 144:
      return combos >= 15 ? 100 : null;
    default:
      return null;
  }
}

/** Colours required by the colour-count awakenings; values come from the table. */
const COLOUR_THRESHOLD: Record<number, number> = {
  79: 3,
  112: 3,
  80: 4,
  113: 4,
  81: 5,
  114: 5,
  44: 5,
};

function colourBoostFor(id: number, colours: number): number | null {
  const needed = COLOUR_THRESHOLD[id];
  if (needed == null || colours < needed) return null;
  return AWAKENING_MULTIPLIERS[id]?.atk ?? null;
}

function accelerationFor(floor: number): number | null {
  if (floor >= 15) return 150;
  if (floor >= 12) return 120;
  if (floor >= 9) return 90;
  if (floor >= 6) return 60;
  if (floor >= 3) return 30;
  return null;
}

/** Multiplier from `subtotal`-kind awakenings on the card for this turn. */
function subtotalAwakeningMultiplier(
  attacking: number,
  input: CardDamageInput,
  combos: number
): number {
  const { card, board } = input;
  const matches = board.matches;
  const colours = new Set(
    matches.map((m) => m.attribute).filter((a) => a >= 0 && a <= 4)
  ).size;
  const matched = (attr: number) => matches.some((m) => m.attribute === attr);
  const healL = matches.some(
    (m) => m.attribute === HEAL_ATTRIBUTE && m.shape === "l"
  );
  const healVdp = matches.some(
    (m) => m.attribute === HEAL_ATTRIBUTE && m.shape === "vdp"
  );
  const blob = matches.some((m) => m.attribute === attacking && m.orbs >= 12);
  const hpRatio = card.hpRatio ?? 1;
  const floor = board.floor ?? 1;
  const puzzle = board.puzzleTimeSeconds ?? null;

  let mult = 1;
  for (const def of defsOf(card.awakenings)) {
    if (def.kind !== "subtotal") continue;
    const atk = def.atk ?? 1;
    const combo = comboBoostFor(def.id, combos);
    if (combo != null) {
      mult *= combo;
      continue;
    }
    if (def.id === 141) {
      if (puzzle != null && puzzle <= 5 && colours >= 4) mult *= atk;
      continue;
    }
    const colour = colourBoostFor(def.id, colours);
    if (colour != null) {
      mult *= colour;
      continue;
    }
    switch (def.id) {
      case 57:
        if (hpRatio >= 0.5) mult *= atk;
        break;
      case 58:
        if (hpRatio <= 0.5) mult *= atk;
        break;
      case 59:
        if (healL) mult *= atk;
        break;
      case 50:
        if (healVdp) mult *= atk;
        break;
      case 71:
        if (matched(JAMMER_ATTRIBUTE)) mult *= atk;
        break;
      case 72:
        if (matched(POISON_ATTRIBUTE)) mult *= atk;
        break;
      case 82:
        if (blob) mult *= atk;
        break;
      case 133:
        if (matched(0) && matched(1)) mult *= atk;
        break;
      case 134:
        if (matched(1) && matched(2)) mult *= atk;
        break;
      case 135:
        if (matched(2) && matched(0)) mult *= atk;
        break;
      case 106:
        if (board.superGravity) mult *= atk;
        break;
      case 143: {
        const accel = accelerationFor(floor);
        if (accel != null) mult *= accel;
        break;
      }
      default:
        break;
    }
  }
  return mult;
}

function killerMultiplier(
  card: DamageCardInput,
  enemy: DamageEnemyInput
): { mult: number; capMult: number } {
  const types = new Set(enemy.types ?? []);
  let mult = 1;
  let capMult = 1;
  for (const id of card.awakenings) {
    const type = KILLER_TARGET_TYPE[id];
    if (type == null || !types.has(type)) continue;
    const def = AWAKENING_MULTIPLIERS[id];
    mult *= def?.atk ?? 1;
    capMult = Math.max(
      capMult,
      id >= 39 ? MATERIAL_KILLER_CAP_MULT : TYPE_KILLER_CAP_MULT
    );
  }
  const latents = Math.max(0, card.matchedKillerLatents ?? 0);
  mult *= Math.pow(KILLER_LATENT_ATK, latents);
  return { mult, capMult };
}

function fixedBonus(
  card: DamageCardInput,
  matches: DamageMatchInput[]
): number {
  let total = 0;
  const healRow = matches.some(
    (m) => m.attribute === HEAL_ATTRIBUTE && m.isRow === true
  );
  const healVdp = matches.some(
    (m) => m.attribute === HEAL_ATTRIBUTE && m.shape === "vdp"
  );
  for (const def of defsOf(card.awakenings)) {
    if (def.id === 45 && healRow) total += def.fixedDamage ?? 0;
    if (def.id === 50 && healVdp) total += def.fixedDamage ?? 0;
  }
  return total;
}

/**
 * Full pipeline for one card / one attribute slot against one enemy.
 * Every intermediate value is reported so a UI can show the breakdown.
 */
export function computeCardDamage(input: CardDamageInput): CardDamageResult {
  const { card, board } = input;
  const enemy = input.enemy ?? {};
  const expanded = enemy.expandedCap === true;
  const slot = card.slot ?? "main";
  const attacking =
    slot === "sub" ? card.subAttribute ?? null : card.mainAttribute;
  const teamAwakenings = board.teamAwakenings ?? card.awakenings;
  const combos = board.combos ?? board.matches.length;

  const perMatch = board.matches.map((m) => computeMatchDamage(m, input));
  let subtotal = perMatch.reduce((s, d) => s + d, 0);
  let capped = false;
  const killer = killerMultiplier(card, enemy);
  const damageCap = damageCapFor(
    Math.max(expanded ? 2 : 1, enemy.capMultiplier ?? 1, killer.capMult)
  );
  const cap = (v: number) => {
    const c = capAt(v, damageCap);
    if (c !== v) capped = true;
    return c;
  };

  if (attacking != null && subtotal > 0) {
    subtotal *= rowEnhanceFactor(attacking, board.matches, teamAwakenings);
    subtotal *= comboEnhanceFactor(attacking, board.matches, teamAwakenings);
    subtotal *= subtotalAwakeningMultiplier(attacking, input, combos);
    subtotal *= 1 + 0.25 * Math.max(0, combos - 1);
    subtotal *= board.leaderMultiplier ?? 1;
  }
  const subtotalCapped = cap(subtotal);

  const afterKiller = cap(subtotalCapped * killer.mult);
  const advantage =
    attacking != null ? attributeAdvantage(attacking, enemy.attribute) : 1;
  const afterAttribute = cap(afterKiller * advantage);

  const ignoresDefense =
    card.awakenings.includes(44) &&
    new Set(board.matches.map((m) => m.attribute).filter((a) => a <= 4)).size >= 5;
  const defense = ignoresDefense ? 0 : Math.max(0, enemy.defense ?? 0);
  const afterDefense =
    afterAttribute > 0 ? Math.max(1, afterAttribute - defense) : 0;

  const actual = cap(afterDefense * (enemy.passiveMultiplier ?? 1));

  return {
    perMatch,
    subtotal,
    subtotalCapped,
    afterKiller,
    afterAttribute,
    afterDefense,
    actual,
    capped,
    expandedCap: damageCap > DAMAGE_CAP,
    damageCap,
    fixedBonusDamage: fixedBonus(card, board.matches),
  };
}

/** Count of a given awakening id on a card (helper for UIs). */
export function awakeningCount(awakenings: number[], id: number): number {
  return countId(awakenings, id);
}
