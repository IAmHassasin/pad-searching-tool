/**
 * Single source of truth for awakening multipliers.
 *
 * Sources (newest wins when they disagree; conflicts are listed in
 * docs/team-build-stat-modifiers.md):
 * - "dadguide awoken_skills desc_en 2026-10" — seed/dadguide.sqlite text.
 * - "padsujiko 2024-09-29" — 火力覚醒まとめ table (x.com/padsujiko/status/1840427736885813462).
 * - "feth v20.4 2023-01-21" — damage formula sheet (i.imgur.com/8USAru3.png).
 * - "gungho patch notes 2024-2026" — official Ver.21.6–23.6 notes cross-checked on
 *   GameWith / AppMedia / Kamigame (research 2026-11-04); newest, wins conflicts.
 */

export type StatMultipliers = {
  hp: number;
  atk: number;
  rcv: number;
};

export type AwkModifierSettings = {
  /** Awakening ids the user allows to affect stat sorting. */
  enabled: number[];
  /** Yin/Yang Protection — only one may be enabled. */
  yinYang: 128 | 129 | null;
  /** Self-Reliance vs Assist Resonate — only one may be enabled. */
  selfOrAssist: 138 | 139 | null;
  /** Aging battle threshold. */
  agingBattle: 5 | 10;
  /** Combo count for awk 43 (7 → ×2 ATK, 14 → ×3 ATK). */
  combo43: 7 | 14;
  /** Awk 57 vs 58 — only one may be enabled. */
  atk57or58: 57 | 58 | null;
  /** Battle threshold for awk 143 ATK scaling. */
  battle143: 3 | 6 | 9 | 12 | 15;
  /** Broken parts for awk 131 (0–10, ×1.2 each). */
  parts131: number;
};

export const DEFAULT_AWK_MODIFIER_SETTINGS: AwkModifierSettings = {
  enabled: [],
  yinYang: null,
  selfOrAssist: null,
  agingBattle: 10,
  combo43: 14,
  atk57or58: null,
  battle143: 15,
  parts131: 10,
};

export type AwakeningMultiplierSource =
  | "dadguide awoken_skills desc_en 2026-10"
  | "padsujiko 2024-09-29"
  | "feth v20.4 2023-01-21"
  /** GungHo patch notes Ver.21.6–23.6 as cross-checked on GameWith / AppMedia (research 2026-11-04). */
  | "gungho patch notes 2024-2026";

/**
 * Where in the damage pipeline the awakening applies.
 * - `stat`: passive HP/ATK/RCV multiplier (team screen or dungeon-conditional).
 * - `flat`: flat HP/ATK/RCV added to the card (Enhanced HP / Attack / Recovery).
 * - `team`: percentage added to the whole team's HP / RCV per copy (46 / 47).
 * - `match`: per-match shape multiplier (TPA, VDP, L, cross, T, column).
 * - `subtotal`: multiplies the card sub-total (combo boost, colour boost, HP side…).
 * - `row`: row enhance — `1 + perUnit × rows × count on team`.
 * - `combo-enhance`: attribute combo enhance — `1 + perUnit × count × (matches − 1)`.
 * - `orb-enhance`: enhanced orbs — `+perUnit` per enhanced orb per awakening on team.
 * - `killer`: ×atk against matching enemy types (actual-damage step).
 * - `fixed`: flat bonus damage after the attack.
 */
export type AwakeningMultiplierKind =
  | "stat"
  | "flat"
  | "team"
  | "match"
  | "subtotal"
  | "row"
  | "combo-enhance"
  | "orb-enhance"
  | "killer"
  | "fixed";

export type AwakeningMultiplierDef = {
  id: number;
  name: string;
  kind: AwakeningMultiplierKind;
  hp?: number;
  atk?: number;
  rcv?: number;
  /** Increment per unit for `row`, `combo-enhance`, and `orb-enhance` kinds. */
  perUnit?: number;
  /** Flat stat added per copy (`flat` kind). */
  flat?: Partial<StatMultipliers>;
  /** Team-wide percentage per copy (`team` kind), e.g. `{ hp: 5 }`. */
  teamPct?: Partial<StatMultipliers>;
  /** Human-readable activation condition. */
  condition?: string;
  /** Flat bonus damage dealt after the attack (`fixed` kind or 50). */
  fixedDamage?: number;
  /** Orb attribute id (0 fire … 4 dark, 5 heal) the awakening is tied to. */
  attribute?: number;
  /** Enemy type id a killer awakening targets. */
  killerType?: number;
  source: AwakeningMultiplierSource;
  /** Settings-dependent stat multiplier (combo count, floor, broken parts…). */
  resolve?: (settings: AwkModifierSettings) => StatMultipliers;
};

const DB: AwakeningMultiplierSource = "dadguide awoken_skills desc_en 2026-10";
const TWEET: AwakeningMultiplierSource = "padsujiko 2024-09-29";
const SHEET: AwakeningMultiplierSource = "feth v20.4 2023-01-21";
const PATCH: AwakeningMultiplierSource = "gungho patch notes 2024-2026";

export const ALL_STATS = (n: number): StatMultipliers => ({ hp: n, atk: n, rcv: n });
const ATK_ONLY = (n: number): StatMultipliers => ({ hp: 1, atk: n, rcv: 1 });

/** Killer awakening ids — each grants ×5 ATK when active. */
export const KILLER_AWAKENING_IDS = [
  31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
] as const;

/** dadguide type ids targeted by each killer awakening. */
export const KILLER_TARGET_TYPE: Record<number, number> = {
  31: 4, // Dragon
  32: 5, // God
  33: 7, // Devil
  34: 8, // Machine
  35: 1, // Balanced
  36: 6, // Attacker
  37: 2, // Physical
  38: 3, // Healer
  39: 12, // Evo material
  40: 13, // Awaken material
  41: 14, // Enhance material
  42: 15, // Redeemable material
};

export const KILLER_ATK = 5;
/** Material killers (39–42) grant ×3 (GameWith lists ×5; AppMedia / Kamigame ×3). */
export const MATERIAL_KILLER_ATK = 3;
/** Killer latent awakenings grant ×2 against the matching type. */
export const KILLER_LATENT_ATK = 2;
/** Damage cap multiplier when a type killer (31–38) matches the enemy (Ver.21.7). */
export const TYPE_KILLER_CAP_MULT = 2;
/** Damage cap multiplier when only a material killer (39–42) matches. */
export const MATERIAL_KILLER_CAP_MULT = 1.2;

/** Flat stat added by `flat`-kind awakenings on a card (duplicates count). */
export function flatAwakeningStats(awakenings: number[]): StatMultipliers {
  const out = { hp: 0, atk: 0, rcv: 0 };
  for (const id of awakenings) {
    const def = AWAKENING_MULTIPLIERS[id];
    if (!def || def.kind !== "flat" || !def.flat) continue;
    out.hp += def.flat.hp ?? 0;
    out.atk += def.flat.atk ?? 0;
    out.rcv += def.flat.rcv ?? 0;
  }
  return out;
}

/** Team-wide % from `team`-kind awakenings across the given awakening ids. */
export function teamAwakeningPct(awakenings: number[]): StatMultipliers {
  const out = { hp: 0, atk: 0, rcv: 0 };
  for (const id of awakenings) {
    const def = AWAKENING_MULTIPLIERS[id];
    if (!def || def.kind !== "team" || !def.teamPct) continue;
    out.hp += def.teamPct.hp ?? 0;
    out.atk += def.teamPct.atk ?? 0;
    out.rcv += def.teamPct.rcv ?? 0;
  }
  return out;
}

/** Combo thresholds for Enhanced Combos (43 / 107). */
export function combo43Atk(combo: AwkModifierSettings["combo43"]): number {
  return combo === 7 ? 2 : 3;
}

function atk143ForBattle(battle: AwkModifierSettings["battle143"]): number {
  switch (battle) {
    case 3:
      return 30;
    case 6:
      return 60;
    case 9:
      return 90;
    case 12:
      return 120;
    default:
      return 150;
  }
}

const ATTRIBUTE_NAMES = ["Fire", "Water", "Wood", "Light", "Dark"] as const;

function perAttribute(
  baseId: number,
  make: (attribute: number, name: string) => Omit<AwakeningMultiplierDef, "id" | "attribute">
): AwakeningMultiplierDef[] {
  return ATTRIBUTE_NAMES.map((name, attribute) => ({
    id: baseId + attribute,
    attribute,
    ...make(attribute, name),
  }));
}

const KILLER_NAMES: Record<number, string> = {
  31: "Dragon Killer",
  32: "God Killer",
  33: "Devil Killer",
  34: "Machine Killer",
  35: "Balanced Killer",
  36: "Attacker Killer",
  37: "Physical Killer",
  38: "Healer Killer",
  39: "Evo Killer",
  40: "Awaken Killer",
  41: "Enhance Killer",
  42: "Redeemable Killer",
};

const DEFS: AwakeningMultiplierDef[] = [
  // --- Enhanced orbs (per-match orb-enhance factor) ---------------------
  ...perAttribute(14, (_, name) => ({
    name: `Enhanced ${name} Orbs`,
    kind: "orb-enhance",
    perUnit: 0.07,
    condition: "+7% damage per enhanced orb matched, per awakening on team",
    source: SHEET,
  })),
  ...perAttribute(99, (_, name) => ({
    name: `Enhanced ${name} Orbs+`,
    kind: "orb-enhance",
    perUnit: 0.14,
    condition: "+14% damage per enhanced orb matched, per awakening on team",
    source: DB,
  })),

  // --- Row enhance (Ver.23.6: 30% → 90%, triple rows merged into one) ----
  ...perAttribute(22, (_, name) => ({
    name: `Enhanced ${name} Att.`,
    kind: "row",
    perUnit: 0.9,
    condition: "+90% per full row matched, per awakening on team",
    source: PATCH,
  })),
  ...perAttribute(116, (_, name) => ({
    name: `Triple Enhanced ${name} Rows`,
    kind: "row",
    perUnit: 0.9,
    condition: "+90% per full row matched, per awakening on team (retired in Ver.23.6)",
    source: PATCH,
  })),

  // --- Flat stat awakenings (Ver.23.0 / 23.5 values) ---------------------
  { id: 1, name: "Enhanced HP", kind: "flat", flat: { hp: 3000 }, condition: "+3000 HP per copy", source: PATCH },
  { id: 2, name: "Enhanced Attack", kind: "flat", flat: { atk: 1000 }, condition: "+1000 ATK per copy", source: PATCH },
  { id: 3, name: "Enhanced Recovery", kind: "flat", flat: { rcv: 500 }, condition: "+500 RCV per copy", source: PATCH },
  { id: 46, name: "Enhanced Team HP", kind: "team", teamPct: { hp: 5 }, condition: "team HP +5% per copy", source: PATCH },
  { id: 47, name: "Enhanced Team Recovery", kind: "team", teamPct: { rcv: 20 }, condition: "team RCV +20% per copy", source: PATCH },

  // --- Attribute combo enhance -----------------------------------------
  ...perAttribute(73, (_, name) => ({
    name: `${name} Combo Enhance`,
    kind: "combo-enhance",
    perUnit: 0.3,
    condition: "+30% per match past the first (needs ≥2 matches), per awakening on team",
    source: DB,
  })),
  ...perAttribute(121, (_, name) => ({
    name: `Enhanced ${name} Combos+`,
    kind: "combo-enhance",
    perUnit: 0.6,
    condition: "+60% per match past the first (needs ≥2 matches), per awakening on team",
    source: TWEET,
  })),

  // --- Per-match shape awakenings --------------------------------------
  { id: 27, name: "Two-Pronged Attack", kind: "match", atk: 2.2, condition: "exactly 4 orbs matched", source: DB },
  { id: 96, name: "Two-Pronged Attack+", kind: "match", atk: 4.84, condition: "exactly 4 orbs matched", source: DB },
  { id: 48, name: "Damage Void Piercer", kind: "match", atk: 3.5, condition: "3×3 square matched", source: DB },
  { id: 109, name: "Damage Void Piercer+", kind: "match", atk: 12.25, condition: "3×3 square matched", source: DB },
  { id: 60, name: "[L] Increased Attack", kind: "match", atk: 2.2, condition: "L shape matched", source: DB },
  { id: 108, name: "[L] Increased Attack+", kind: "match", atk: 4.84, condition: "L shape matched", source: DB },
  { id: 78, name: "Cross Attack", kind: "match", atk: 3, condition: "cross shape matched", source: DB },
  { id: 110, name: "Cross Attack+", kind: "match", atk: 9, condition: "cross shape matched", source: DB },
  { id: 126, name: "[T] Increased Attack", kind: "match", atk: 8, condition: "T shape matched", source: DB },
  ...perAttribute(149, (_, name) => ({
    name: `${name} Column Attack`,
    kind: "match",
    atk: 7,
    condition: "full column matched",
    source: TWEET,
  })),

  // --- Sub-total multipliers -------------------------------------------
  {
    id: 43,
    name: "Enhanced Combos",
    kind: "subtotal",
    atk: 3,
    condition: "7+ combos ×2; 14+ combos ×3",
    source: DB,
    resolve: (s) => ATK_ONLY(combo43Atk(s.combo43)),
  },
  {
    id: 107,
    name: "Enhanced Combos+",
    kind: "subtotal",
    atk: 9,
    condition: "7+ combos ×4; 14+ combos ×9",
    source: DB,
    resolve: (s) => {
      const base = combo43Atk(s.combo43);
      return ATK_ONLY(base * base);
    },
  },
  { id: 61, name: "Super Enhanced Combos", kind: "subtotal", atk: 5, condition: "10+ combos", source: DB },
  { id: 111, name: "Super Enhanced Combos+", kind: "subtotal", atk: 25, condition: "10+ combos", source: DB },
  { id: 144, name: "Supreme Enhanced Combos", kind: "subtotal", atk: 100, condition: "15+ combos", source: DB },
  // Colour boosts: Ver.23.0 / 23.3.2 raised 3-colour to 3.5 (+ 12.25) and 4-colour to 4.5 (+ 20.25).
  { id: 79, name: "3-Color ATK Enhance", kind: "subtotal", atk: 3.5, condition: "3+ colours matched", source: PATCH },
  { id: 80, name: "4-Color ATK Enhance", kind: "subtotal", atk: 4.5, condition: "4+ colours matched", source: PATCH },
  { id: 81, name: "5-Color ATK Enhance", kind: "subtotal", atk: 5, condition: "5 colours matched", source: DB },
  { id: 112, name: "3 Att. Enhanced Attack+", kind: "subtotal", atk: 12.25, condition: "3+ colours matched", source: PATCH },
  { id: 113, name: "4 Att. Enhanced Attack+", kind: "subtotal", atk: 20.25, condition: "4+ colours matched", source: PATCH },
  { id: 114, name: "5 Att. Enhanced Attack+", kind: "subtotal", atk: 25, condition: "5 colours matched", source: DB },
  { id: 44, name: "Guard Break", kind: "subtotal", atk: 3, condition: "5 colours matched; ignores DEF", source: DB },
  // HP-side boosts: Ver.23.4 raised 2.5 → 10 (owned copies were reduced in the same patch).
  { id: 57, name: "50% or more HP Enhanced", kind: "subtotal", atk: 10, condition: "HP ≥ 50%", source: PATCH },
  { id: 58, name: "50% or less HP Enhanced", kind: "subtotal", atk: 10, condition: "HP ≤ 50%", source: PATCH },
  { id: 59, name: "[L] Heal Matching", kind: "subtotal", atk: 3, condition: "5 heal orbs in L shape", source: DB },
  // Blessings: Ver.23.4 raised 2 → 10.
  { id: 71, name: "Blessing of Jammers", kind: "subtotal", atk: 10, condition: "jammer orbs matched", source: PATCH },
  { id: 72, name: "Blessing of Poison Orbs", kind: "subtotal", atk: 10, condition: "poison orbs matched", source: PATCH },
  { id: 82, name: "Blob Match Boost", kind: "subtotal", atk: 12, condition: "12+ connected orbs of own attribute", source: DB },
  {
    id: 50,
    name: "Super Bonus Attack",
    kind: "subtotal",
    atk: 8,
    fixedDamage: 10_000_000,
    condition: "3×3 heal square matched; also 10,000,000 fixed damage",
    source: DB,
  },
  { id: 141, name: "Expert Multi-Match", kind: "subtotal", atk: 50, condition: "puzzle time ≤ 5s and 4+ colours", source: DB },
  { id: 133, name: "Fire Water Attack", kind: "subtotal", atk: 50, condition: "fire and water orbs matched", source: DB },
  { id: 134, name: "Water Wood Attack", kind: "subtotal", atk: 50, condition: "water and wood orbs matched", source: DB },
  { id: 135, name: "Wood Fire Attack", kind: "subtotal", atk: 50, condition: "wood and fire orbs matched", source: DB },
  { id: 106, name: "Levitation", kind: "subtotal", atk: 20, condition: "super gravity dungeon", source: TWEET },
  {
    id: 143,
    name: "Acceleration",
    kind: "subtotal",
    atk: 150,
    condition: "×30 from floor 3, ×60 floor 6, ×90 floor 9, ×120 floor 12, ×150 floor 15",
    source: DB,
    resolve: (s) => ATK_ONLY(atk143ForBattle(s.battle143)),
  },

  // --- Fixed damage ----------------------------------------------------
  { id: 45, name: "Bonus Attack", kind: "fixed", fixedDamage: 500_000, condition: "heal row matched; 20% damage to shields", source: PATCH },

  // --- Passive stat multipliers ----------------------------------------
  { id: 128, name: "Yang Protection", kind: "stat", hp: 2, rcv: 2, atk: 5, condition: "Sun dungeons", source: DB },
  { id: 129, name: "Yin Protection", kind: "stat", hp: 2, rcv: 2, atk: 5, condition: "Moon dungeons", source: DB },
  { id: 138, name: "Assist Resonance", kind: "stat", hp: 3, atk: 3, rcv: 3, condition: "assist shares main attribute and a type", source: DB },
  { id: 139, name: "Self-Reliance", kind: "stat", hp: 3, atk: 3, rcv: 3, condition: "no assist equipped", source: DB },
  {
    id: 130,
    name: "Aging",
    kind: "stat",
    hp: 2,
    atk: 2,
    rcv: 2,
    condition: "×1.5 from floor 5, ×2 from floor 10",
    source: DB,
    resolve: (s) => ALL_STATS(s.agingBattle === 5 ? 1.5 : 2),
  },
  { id: 132, name: "Afternoon Tea", kind: "stat", hp: 1.25, atk: 1.25, rcv: 1.25, source: DB },
  { id: 30, name: "Multi Boost", kind: "stat", hp: 1.5, atk: 1.5, rcv: 1.5, condition: "multiplayer", source: DB },
  { id: 127, name: "Enhanced Stat", kind: "stat", hp: 1.5, atk: 1.5, rcv: 1.5, source: DB },
  { id: 142, name: "Enhanced Stats+", kind: "stat", hp: 1.8, atk: 1.8, rcv: 1.8, source: DB },
  { id: 63, name: "Skill Voice", kind: "stat", hp: 1.1, atk: 1.1, rcv: 1.1, source: DB },
  { id: 145, name: "Soul of Hope", kind: "stat", hp: 1.5, atk: 1.5, rcv: 1.5, source: DB },
  { id: 146, name: "Soul of Bravery", kind: "stat", hp: 1.5, atk: 1.5, rcv: 1.5, source: DB },
  { id: 147, name: "Soul of Luck", kind: "stat", hp: 1.5, atk: 1.5, rcv: 1.5, source: DB },
  {
    id: 131,
    name: "Part Break Bonus",
    kind: "stat",
    condition: "×1.2 per broken part (0–10)",
    source: SHEET,
    resolve: (s) =>
      ALL_STATS(Math.pow(1.2, Math.max(0, Math.min(10, s.parts131)))),
  },

  // --- Killers ---------------------------------------------------------
  ...KILLER_AWAKENING_IDS.map<AwakeningMultiplierDef>((id) => ({
    id,
    name: KILLER_NAMES[id],
    kind: "killer",
    atk: id >= 39 ? MATERIAL_KILLER_ATK : KILLER_ATK,
    killerType: KILLER_TARGET_TYPE[id],
    condition:
      id >= 39
        ? "enemy has the matching material type; damage cap ×1.2"
        : "enemy has the matching type; damage cap ×2",
    source: id >= 39 ? PATCH : SHEET,
  })),
];

export const AWAKENING_MULTIPLIERS: Readonly<Record<number, AwakeningMultiplierDef>> =
  Object.freeze(Object.fromEntries(DEFS.map((d) => [d.id, d])));

export function awakeningMultiplierDef(
  awkId: number
): AwakeningMultiplierDef | undefined {
  return AWAKENING_MULTIPLIERS[awkId];
}

/** Ids of every awakening in the table with the given pipeline kind. */
export function awakeningIdsOfKind(kind: AwakeningMultiplierKind): number[] {
  return DEFS.filter((d) => d.kind === kind).map((d) => d.id);
}

/**
 * Stat multiplier (HP / ATK / RCV) an awakening contributes when its
 * condition is treated as met. Pipeline-only kinds (`row`, `combo-enhance`,
 * `orb-enhance`, `fixed`) have no static multiplier and return ×1.
 */
export function awakeningStatMultipliers(
  awkId: number,
  settings: AwkModifierSettings = DEFAULT_AWK_MODIFIER_SETTINGS
): StatMultipliers {
  const def = AWAKENING_MULTIPLIERS[awkId];
  if (!def) return ALL_STATS(1);
  if (def.resolve) return def.resolve(settings);
  switch (def.kind) {
    case "stat":
    case "match":
    case "subtotal":
    case "killer":
      return { hp: def.hp ?? 1, atk: def.atk ?? 1, rcv: def.rcv ?? 1 };
    default:
      return ALL_STATS(1);
  }
}
