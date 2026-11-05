import type { AwkModifierSettings } from "../awakening-stat-modifier.ts";
import type { MonsterRecord } from "../../types.ts";

export type MonsterLevelTarget = 99 | 110 | 120;

export type TeamBadgeId =
  | "none"
  | "hp_10"
  | "hp_15"
  | "rcv_50"
  | "rcv_70"
  | "atk_10"
  | "atk_15"
  | "all_50"
  | "team_hp_rcv_5"
  | "type_god"
  | "type_dragon"
  | "type_devil"
  | "type_machine"
  | "type_balance"
  | "type_attacker"
  | "type_physical"
  | "type_healer"
  | "collab_base"
  | "collab_plus"
  | "idol";

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
  /** Optional (older drafts omit it); defaults to 0. */
  eqPlusAtk?: number;
  level: MonsterLevelTarget;
  /** Active super awakening / sync awk; null = none. */
  selectedSuperAwakening: number | null;
};

/** User-defined dungeon modifiers used when `dungeonId === "custom"`. */
export type CustomDungeonModifiers = {
  hp: number;
  atk: number;
  rcv: number;
  sun: boolean;
  moon: boolean;
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
  /** Entry id in the dungeon catalog; "none" = no dungeon, "custom" = `customDungeon`. */
  dungeonId: string;
  customDungeon: CustomDungeonModifiers;
};

export const DEFAULT_CUSTOM_DUNGEON: CustomDungeonModifiers = {
  hp: 1,
  atk: 1,
  rcv: 1,
  sun: false,
  moon: false,
};

export type StatBreakdown = {
  base: number;
  afterLevel: number;
  afterPlus: number;
  afterAwk: number;
  afterAssist: number;
  /** After the flat Enhanced HP / Attack / Recovery awakenings (1 / 2 / 3). */
  afterFlatAwk: number;
  /** Level + plus + flat awk + super awk + assist (no dungeon awk, badge, or LS). */
  afterRaw: number;
  afterLeader: number;
  /** Leader-skill value × dungeon modifiers — the per-slot value (PDC ステ). */
  afterDungeon: number;
  /** afterDungeon × badge × team awakenings (46 / 47) — team totals sum this. */
  afterBadge: number;
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
    // Assists default to +297 like the card itself (PDC assumes the same).
    eqPlusHp: 99,
    eqPlusRcv: 99,
    eqPlusAtk: 99,
    level: 120,
    selectedSuperAwakening: null,
  };
}

export function defaultTeamBuildConfig(
  awkSettings?: import("../awakening-stat-modifier.ts").AwkModifierSettings
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
    dungeonId: "none",
    customDungeon: { ...DEFAULT_CUSTOM_DUNGEON },
  };
}
