/** Flat + per plus point ([GameWith 108048](https://xn--0ck4aw2h.gamewith.jp/article/show/108048)). */
export const PLUS_HP_PER_POINT = 10;
export const PLUS_ATK_PER_POINT = 5;
export const PLUS_RCV_PER_POINT = 3;

/** Lv.110→120 extra % ([039日記](https://diary-039.com/entry/2021/03/25/pad_status-lv120_01)). */
export const LEVEL_120_EXTRA_PCT = {
  hp: 10,
  atk: 5,
  rcv: 5,
} as const;

/** Assist bonus when attributes match ([GameWith 24527](https://xn--0ck4aw2h.gamewith.jp/article/show/24527)). */
export const ASSIST_BONUS_PCT = {
  hp: 10,
  atk: 5,
  rcv: 15,
} as const;

export type BadgeStatPct = { hp: number; rcv: number; atk: number };

/**
 * Team-wide badge percentages — GameWith 31941 / AppMedia badge list and the
 * Ver.22.0 / 23.0 / 2026-05-08 GungHo notes (research 2026-11-04).
 * Collab / event / idol badges only affect matching monsters in-game; here
 * they apply to every slot, so use them with an all-collab team.
 */
export const BADGE_TEAM_PCT: Record<
  import("./types.ts").TeamBadgeId,
  BadgeStatPct
> = {
  none: { hp: 0, rcv: 0, atk: 0 },
  hp_10: { hp: 10, rcv: 0, atk: 0 },
  hp_15: { hp: 15, rcv: 0, atk: 0 },
  rcv_50: { hp: 0, rcv: 50, atk: 0 },
  rcv_70: { hp: 0, rcv: 70, atk: 0 },
  atk_10: { hp: 0, rcv: 0, atk: 10 },
  atk_15: { hp: 0, rcv: 0, atk: 15 },
  all_50: { hp: 50, rcv: 50, atk: 50 },
  team_hp_rcv_5: { hp: 5, rcv: 5, atk: 0 },
  type_god: { hp: 5, rcv: 5, atk: 0 },
  type_dragon: { hp: 5, rcv: 5, atk: 0 },
  type_devil: { hp: 5, rcv: 5, atk: 0 },
  type_machine: { hp: 5, rcv: 5, atk: 0 },
  type_balance: { hp: 5, rcv: 5, atk: 0 },
  type_attacker: { hp: 5, rcv: 5, atk: 0 },
  type_physical: { hp: 5, rcv: 5, atk: 0 },
  type_healer: { hp: 5, rcv: 5, atk: 0 },
  collab_base: { hp: 15, rcv: 15, atk: 50 },
  collab_plus: { hp: 30, rcv: 30, atk: 150 },
  idol: { hp: 30, rcv: 30, atk: 200 },
};

/** Type badges: ATK ×5 for members of the type (dadguide type ids). */
export const BADGE_TYPE_ATK: Partial<
  Record<import("./types.ts").TeamBadgeId, { typeId: number; mult: number }>
> = {
  type_god: { typeId: 5, mult: 5 },
  type_dragon: { typeId: 4, mult: 5 },
  type_devil: { typeId: 7, mult: 5 },
  type_machine: { typeId: 8, mult: 5 },
  type_balance: { typeId: 1, mult: 5 },
  type_attacker: { typeId: 6, mult: 5 },
  type_physical: { typeId: 2, mult: 5 },
  type_healer: { typeId: 3, mult: 5 },
};

export const BADGE_OPTIONS: {
  id: import("./types.ts").TeamBadgeId;
  label: string;
}[] = [
  { id: "none", label: "None" },
  { id: "hp_15", label: "HP +15% (team)" },
  { id: "hp_10", label: "HP +10% (team)" },
  { id: "rcv_70", label: "RCV +70% (team)" },
  { id: "rcv_50", label: "RCV +50% (team)" },
  { id: "atk_15", label: "ATK +15% (team)" },
  { id: "atk_10", label: "ATK +10% (team)" },
  { id: "all_50", label: "All stats +50% (Skill Boost++ / Status Resist badge)" },
  { id: "team_hp_rcv_5", label: "HP & RCV +5% (shape / colour attack badges)" },
  { id: "type_god", label: "God type: ATK ×5, team HP & RCV +5%" },
  { id: "type_dragon", label: "Dragon type: ATK ×5, team HP & RCV +5%" },
  { id: "type_devil", label: "Devil type: ATK ×5, team HP & RCV +5%" },
  { id: "type_machine", label: "Machine type: ATK ×5, team HP & RCV +5%" },
  { id: "type_balance", label: "Balanced type: ATK ×5, team HP & RCV +5%" },
  { id: "type_attacker", label: "Attacker type: ATK ×5, team HP & RCV +5%" },
  { id: "type_physical", label: "Physical type: ATK ×5, team HP & RCV +5%" },
  { id: "type_healer", label: "Healer type: ATK ×5, team HP & RCV +5%" },
  { id: "collab_base", label: "Collab / event: ATK +50%, HP & RCV +15% (all slots)" },
  { id: "collab_plus", label: "Collab / event+: ATK ×2.5, HP & RCV +30% (all slots)" },
  { id: "idol", label: "Idol: ATK ×3, HP & RCV +30% (all slots)" },
];
