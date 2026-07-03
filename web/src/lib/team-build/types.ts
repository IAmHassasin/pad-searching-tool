import type { AwkModifierSettings } from "../awakening-stat-modifier";
import type { MonsterRecord } from "../../types";

export type MonsterLevelTarget = 99 | 110 | 120;

export type TeamBadgeId =
  | "none"
  | "hp_10"
  | "hp_15"
  | "rcv_50"
  | "rcv_70"
  | "all_50"
  | "team_hp_rcv_5";

export type LatentId =
  | "hp"
  | "rcv"
  | "all_param"
  | "hp_plus"
  | "rcv_plus"
  | "hp_plus_plus"
  | "rcv_plus_plus";

export type TeamSlotRole = "leader" | "sub";

export type TeamMemberConfig = {
  role: TeamSlotRole;
  monsterId: string;
  eqId: string;
  plusHp: number;
  plusAtk: number;
  plusRcv: number;
  /** Assist +points (affects assist bonus calc). */
  eqPlusHp: number;
  eqPlusRcv: number;
  level: MonsterLevelTarget;
  /** Active super awakening / sync awk; null = none. */
  selectedSuperAwakening: number | null;
  /** Count per latent type (respects latent_slots). */
  latents: Partial<Record<LatentId, number>>;
};

export type TeamBuildConfig = {
  members: TeamMemberConfig[];
  badge: TeamBadgeId;
  awkSettings: AwkModifierSettings;
  /** Manual LS multipliers when parse fails (per leader slot). */
  leaderOverrides: [
    { hp: number; rcv: number },
    { hp: number; rcv: number },
  ];
};

export type StatBreakdown = {
  base: number;
  afterLevel: number;
  afterPlus: number;
  afterAwk: number;
  afterLatent: number;
  afterAssist: number;
  /** Level + plus + latent + assist (no dungeon awk, badge, or LS). */
  afterRaw: number;
  afterBadge: number;
  afterLeader: number;
};

export type MemberStatResult = {
  slotIndex: number;
  role: TeamSlotRole;
  config: TeamMemberConfig;
  monster: MonsterRecord | null;
  eq: MonsterRecord | null;
  error?: string;
  hp: StatBreakdown;
  atk: StatBreakdown;
  rcv: StatBreakdown;
};

export type TeamStatSummary = {
  members: MemberStatResult[];
  teamHp: number;
  teamAtk: number;
  teamRcv: number;
  /** Totals using raw per-member stats (no badge / LS). */
  teamRawHp: number;
  teamRawAtk: number;
  teamRawRcv: number;
};

export const TEAM_SIZE = 6;
export const LEADER_COUNT = 2;

export function emptyMember(role: TeamSlotRole): TeamMemberConfig {
  return {
    role,
    monsterId: "",
    eqId: "",
    plusHp: 99,
    plusAtk: 99,
    plusRcv: 99,
    eqPlusHp: 0,
    eqPlusRcv: 0,
    level: 120,
    selectedSuperAwakening: null,
    latents: {},
  };
}

export function defaultTeamBuildConfig(
  awkSettings?: import("../awakening-stat-modifier").AwkModifierSettings
): TeamBuildConfig {
  return {
    members: [
      emptyMember("leader"),
      emptyMember("sub"),
      emptyMember("sub"),
      emptyMember("sub"),
      emptyMember("sub"),
      emptyMember("leader"),
    ],
    badge: "none",
    awkSettings: awkSettings ?? {
      enabled: [],
      yinYang: null,
      selfOrAssist: null,
      agingBattle: 10,
      combo43: 14,
      atk57or58: null,
      battle143: 15,
      parts131: 10,
    },
    leaderOverrides: [
      { hp: 1, rcv: 1 },
      { hp: 1, rcv: 1 },
    ],
  };
}
