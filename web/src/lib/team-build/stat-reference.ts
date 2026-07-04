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
  rcv: 15,
} as const;

export type BadgeStatPct = { hp: number; rcv: number };

/** Team-wide badges — [GameWith 31941](https://xn--0ck4aw2h.gamewith.jp/article/show/31941) */
export const BADGE_TEAM_PCT: Record<
  import("./types").TeamBadgeId,
  BadgeStatPct
> = {
  none: { hp: 0, rcv: 0 },
  hp_10: { hp: 10, rcv: 0 },
  hp_15: { hp: 15, rcv: 0 },
  rcv_50: { hp: 0, rcv: 50 },
  rcv_70: { hp: 0, rcv: 70 },
  all_50: { hp: 50, rcv: 50 },
  team_hp_rcv_5: { hp: 5, rcv: 5 },
};

export const BADGE_OPTIONS: {
  id: import("./types").TeamBadgeId;
  label: string;
}[] = [
  { id: "none", label: "None" },
  { id: "hp_15", label: "HP +15% (team)" },
  { id: "hp_10", label: "HP +10% (team)" },
  { id: "rcv_70", label: "RCV +70% (team)" },
  { id: "rcv_50", label: "RCV +50% (team)" },
  { id: "all_50", label: "All stats +50% (Skill/Status badge)" },
  { id: "team_hp_rcv_5", label: "HP & RCV +5% (awoken enhance badges)" },
];
