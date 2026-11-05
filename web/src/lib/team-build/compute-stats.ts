import {
  computeMonsterStatMultipliers,
  type AwkModifierSettings,
} from "../awakening-stat-modifier.ts";
import { parseRegularAwakenings } from "../awakenings.ts";
import {
  flatAwakeningStats,
  teamAwakeningPct,
  type StatMultipliers,
} from "../damage/awakening-multipliers.ts";
import type { MonsterRecord } from "../../types.ts";
import { computeAssistBonus } from "./assist-bonus.ts";
import { applyTeamBadge } from "./badge-modifiers.ts";
import {
  conditionalStatMultiplier,
  levitationMultiplier,
  neutralDungeonModifiers,
  type ResolvedDungeonModifiers,
} from "./dungeon-modifiers.ts";
import { maxMonsterLevel, scaleStatForLevel } from "./level-scaling.ts";
import {
  grantedAssistAwakenings,
  passiveAwakeningActive,
  passiveAwakeningMultipliers,
  RAW_PASSIVE_AWAKENING_IDS,
  superAwakeningIsPassive,
} from "./passive-awakenings.ts";
import { superAwakeningStatMultipliers } from "./super-awakening-modifier.ts";
import {
  combineLeaderMultipliers,
  leaderMultipliersForMember,
} from "./leader-skill.ts";
import {
  PLUS_ATK_PER_POINT,
  PLUS_HP_PER_POINT,
  PLUS_RCV_PER_POINT,
} from "./stat-reference.ts";
import type {
  MemberStatResult,
  StatBreakdown,
  TeamBuildConfig,
  TeamStatSummary,
} from "./types.ts";

function emptyBreakdown(): StatBreakdown {
  return {
    base: 0,
    afterLevel: 0,
    afterPlus: 0,
    afterFlatAwk: 0,
    afterAwk: 0,
    afterAssist: 0,
    afterRaw: 0,
    afterBadge: 0,
    afterLeader: 0,
    afterDungeon: 0,
  };
}

function plusFlat(
  config: TeamBuildConfig["members"][number],
  stat: "hp" | "atk" | "rcv"
): number {
  if (stat === "hp") return config.plusHp * PLUS_HP_PER_POINT;
  if (stat === "atk") return config.plusAtk * PLUS_ATK_PER_POINT;
  return config.plusRcv * PLUS_RCV_PER_POINT;
}

function computeMemberStat(
  baseLv99: number | null | undefined,
  row: MonsterRecord,
  config: TeamBuildConfig["members"][number],
  eq: MonsterRecord | null,
  awkSettings: AwkModifierSettings,
  badge: TeamBuildConfig["badge"],
  leaderMult: { hp: number; rcv: number },
  dungeon: ResolvedDungeonModifiers,
  teamPct: StatMultipliers,
  stat: "hp" | "atk" | "rcv"
): StatBreakdown {
  const breakdown = emptyBreakdown();
  if (baseLv99 == null || !Number.isFinite(baseLv99)) return breakdown;

  breakdown.base = baseLv99;
  breakdown.afterLevel = scaleStatForLevel(
    baseLv99,
    row,
    config.level,
    stat
  );
  breakdown.afterPlus = breakdown.afterLevel + plusFlat(config, stat);
  // Enhanced HP / Attack / Recovery awakenings add a flat amount per copy
  // (the card's own plus those granted by the assist via Awoken Assist).
  breakdown.afterFlatAwk =
    breakdown.afterPlus +
    flatAwakeningStats([
      ...parseRegularAwakenings(row.awakenings),
      ...grantedAssistAwakenings(eq),
    ])[stat];

  // Assist equipment bonus is added first: every multiplier below also scales
  // it (PDC: Shizuru (9470 + 787) × 3 = 30,771 with Assist Resonance).
  // Assists are always at their own max level (99, or 110/120 when the
  // equipment can limit break), independent of the base card's level.
  const assist = computeAssistBonus(
    row,
    eq,
    eq ? maxMonsterLevel(eq) : config.level,
    config.eqPlusHp,
    config.eqPlusRcv,
    config.eqPlusAtk ?? 0
  );
  const assistBonus = assist[stat];
  const withAssist = breakdown.afterFlatAwk + assistBonus;

  // Passive stat awakenings on the card (Enhanced Stat, Souls, Assist
  // Resonance / Self-Reliance when their assist condition holds).
  const passiveMult = passiveAwakeningMultipliers(row, eq)[stat];
  const selectedSa = config.selectedSuperAwakening;
  const syncId = Number(row.sync_awsid);
  const saMult =
    selectedSa == null
      ? 1
      : selectedSa === syncId && superAwakeningIsPassive(selectedSa)
        ? // The sync awakening is already part of the passive multiplier.
          1
        : superAwakeningIsPassive(selectedSa)
          ? passiveAwakeningActive(selectedSa, row, eq)
            ? superAwakeningStatMultipliers(selectedSa)[stat]
            : 1
          : superAwakeningStatMultipliers(selectedSa)[stat];
  breakdown.afterRaw = Math.round(withAssist * passiveMult * saMult);

  // Dungeon / manual awakenings on top of the passives (passive ids are
  // stripped from the manual selection so they are never counted twice).
  const awkMult = computeMonsterStatMultipliers(row, awkSettings)[stat];
  breakdown.afterAwk = Math.round(withAssist * passiveMult * saMult * awkMult);
  breakdown.afterAssist = breakdown.afterAwk;

  const ls = stat === "atk" ? 1 : leaderMult[stat];
  breakdown.afterLeader = Math.round(breakdown.afterAssist * ls);
  // Slot value (= PDC ステ): dungeon modifiers on top of the leader skill.
  // One rounding at the end: super gravity (×1/500) followed by Levitation
  // (×20) must not truncate in between.
  const dungeonMult =
    Math.max(0, dungeon.stat[stat]) *
    conditionalStatMultiplier(dungeon.conditional, row, stat) *
    (stat === "atk" ? levitationMultiplier(row, dungeon) : 1);
  breakdown.afterDungeon =
    dungeonMult === 1
      ? breakdown.afterLeader
      : Math.round(breakdown.afterLeader * dungeonMult);
  // Team-level: badge, then Enhanced Team HP / RCV awakenings (46 / 47) from
  // the whole team (incl. assists). PDC shows these only in the PT総合 totals.
  breakdown.afterBadge = Math.round(
    applyTeamBadge(breakdown.afterDungeon, badge, stat, row) *
      (1 + Math.max(0, teamPct[stat]) / 100)
  );

  return breakdown;
}

/**
 * Per-member pipeline + team totals. `dungeon` carries the resolved dungeon
 * (stat multipliers + awakenings it activates); omit it for no dungeon.
 */
export function computeTeamStats(
  config: TeamBuildConfig,
  monstersById: Map<number, MonsterRecord>,
  dungeon: ResolvedDungeonModifiers = neutralDungeonModifiers(config)
): TeamStatSummary {
  const awkSettings = {
    ...dungeon.awkSettings,
    enabled: dungeon.awkSettings.enabled.filter(
      (id) => !RAW_PASSIVE_AWAKENING_IDS.includes(id)
    ),
  };
  // Enhanced Team HP / RCV (46 / 47) from every member and from the
  // awakenings their assists grant (PDC: five assists with 15 × 46 → +75 %).
  const teamPct = teamAwakeningPct(
    config.members.flatMap((m) => {
      const id = Number(m.monsterId.trim());
      const row = Number.isFinite(id) && id > 0 ? monstersById.get(id) : null;
      if (!row) return [];
      const eqId = Number(m.eqId.trim());
      const eq = Number.isFinite(eqId) && eqId > 0 ? monstersById.get(eqId) ?? null : null;
      return [
        ...parseRegularAwakenings(row.awakenings),
        ...grantedAssistAwakenings(eq),
      ];
    })
  );
  const leaders = config.members
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.role === "leader");

  const members: MemberStatResult[] = config.members.map((member, slotIndex) => {
    const monsterId = Number(member.monsterId.trim());
    const eqId = Number(member.eqId.trim());
    const monster =
      Number.isFinite(monsterId) && monsterId > 0
        ? monstersById.get(monsterId) ?? null
        : null;
    const eq =
      Number.isFinite(eqId) && eqId > 0
        ? monstersById.get(eqId) ?? null
        : null;

    let error: string | undefined;
    if (member.monsterId.trim() && !monster) {
      error = `Monster ${member.monsterId} not found`;
    } else if (member.eqId.trim() && !eq) {
      error = `Equipment ${member.eqId} not found`;
    }

    const leader0 = leaders[0]
      ? monstersById.get(Number(leaders[0].m.monsterId.trim())) ?? null
      : null;
    const leader1 = leaders[1]
      ? monstersById.get(Number(leaders[1].m.monsterId.trim())) ?? null
      : null;

    const mult0 = monster
      ? leaderMultipliersForMember(
          monster,
          leader0,
          config.leaderOverrides[0]
        )
      : { hp: 1, rcv: 1 };
    const mult1 = monster
      ? leaderMultipliersForMember(
          monster,
          leader1,
          config.leaderOverrides[1]
        )
      : { hp: 1, rcv: 1 };
    const leaderMult = combineLeaderMultipliers(mult0, mult1);

    const hp =
      monster != null
        ? computeMemberStat(
            monster.hp_max,
            monster,
            member,
            eq,
            awkSettings,
            config.badge,
            leaderMult,
            dungeon,
            teamPct,
            "hp"
          )
        : emptyBreakdown();
    const atk =
      monster != null
        ? computeMemberStat(
            monster.atk_max,
            monster,
            member,
            eq,
            awkSettings,
            config.badge,
            leaderMult,
            dungeon,
            teamPct,
            "atk"
          )
        : emptyBreakdown();
    const rcv =
      monster != null
        ? computeMemberStat(
            monster.rcv_max,
            monster,
            member,
            eq,
            awkSettings,
            config.badge,
            leaderMult,
            dungeon,
            teamPct,
            "rcv"
          )
        : emptyBreakdown();

    return {
      slotIndex,
      role: member.role,
      config: member,
      monster,
      eq,
      error,
      hp,
      atk,
      rcv,
    };
  });

  return {
    members,
    teamHp: members.reduce((s, m) => s + m.hp.afterBadge, 0),
    teamAtk: members.reduce((s, m) => s + m.atk.afterBadge, 0),
    teamRcv: members.reduce((s, m) => s + m.rcv.afterBadge, 0),
    teamRawHp: members.reduce((s, m) => s + m.hp.afterRaw, 0),
    teamRawAtk: members.reduce((s, m) => s + m.atk.afterRaw, 0),
    teamRawRcv: members.reduce((s, m) => s + m.rcv.afterRaw, 0),
  };
}
