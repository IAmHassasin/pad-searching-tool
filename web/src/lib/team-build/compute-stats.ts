import {
  computeMonsterStatMultipliers,
  type AwkModifierSettings,
} from "../awakening-stat-modifier";
import type { MonsterRecord } from "../../types";
import { computeAssistBonus } from "./assist-bonus";
import { applyTeamBadge } from "./badge-modifiers";
import { scaleStatForLevel } from "./level-scaling";
import { superAwakeningStatMultipliers } from "./super-awakening-modifier";
import {
  combineLeaderMultipliers,
  leaderMultipliersForMember,
} from "./leader-skill";
import {
  PLUS_ATK_PER_POINT,
  PLUS_HP_PER_POINT,
  PLUS_RCV_PER_POINT,
} from "./stat-reference";
import type {
  MemberStatResult,
  StatBreakdown,
  TeamBuildConfig,
  TeamStatSummary,
} from "./types";

function emptyBreakdown(): StatBreakdown {
  return {
    base: 0,
    afterLevel: 0,
    afterPlus: 0,
    afterAwk: 0,
    afterAssist: 0,
    afterRaw: 0,
    afterBadge: 0,
    afterLeader: 0,
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

  const saMult = superAwakeningStatMultipliers(
    config.selectedSuperAwakening
  )[stat];
  const afterSuperAwakening = Math.round(breakdown.afterPlus * saMult);

  const assist =
    stat === "hp" || stat === "rcv"
      ? computeAssistBonus(
          row,
          eq,
          config.level,
          config.eqPlusHp,
          config.eqPlusRcv
        )
      : { hp: 0, rcv: 0 };
  breakdown.afterRaw =
    afterSuperAwakening +
    (stat === "hp" ? assist.hp : stat === "rcv" ? assist.rcv : 0);

  const awkMult = computeMonsterStatMultipliers(row, awkSettings)[stat];
  breakdown.afterAwk = Math.round(breakdown.afterPlus * awkMult);
  breakdown.afterAssist =
    breakdown.afterAwk +
    (stat === "hp" ? assist.hp : stat === "rcv" ? assist.rcv : 0);

  breakdown.afterBadge =
    stat === "atk"
      ? breakdown.afterAssist
      : applyTeamBadge(breakdown.afterAssist, badge, stat);
  const ls = stat === "atk" ? 1 : leaderMult[stat];
  breakdown.afterLeader = Math.round(breakdown.afterBadge * ls);

  return breakdown;
}

export function computeTeamStats(
  config: TeamBuildConfig,
  monstersById: Map<number, MonsterRecord>
): TeamStatSummary {
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
            config.awkSettings,
            config.badge,
            leaderMult,
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
            config.awkSettings,
            config.badge,
            leaderMult,
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
            config.awkSettings,
            config.badge,
            leaderMult,
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
    teamHp: members.reduce((s, m) => s + m.hp.afterLeader, 0),
    teamAtk: members.reduce((s, m) => s + m.atk.afterLeader, 0),
    teamRcv: members.reduce((s, m) => s + m.rcv.afterLeader, 0),
    teamRawHp: members.reduce((s, m) => s + m.hp.afterRaw, 0),
    teamRawAtk: members.reduce((s, m) => s + m.atk.afterRaw, 0),
    teamRawRcv: members.reduce((s, m) => s + m.rcv.afterRaw, 0),
  };
}
