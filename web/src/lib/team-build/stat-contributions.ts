import {
  isAwkEnabled,
  type AwkModifierSettings,
} from "../awakening-stat-modifier.ts";
import { parseRegularAwakenings } from "../awakenings.ts";
import { AWAKENING_MULTIPLIERS } from "../damage/awakening-multipliers.ts";
import type { MonsterRecord } from "../../types.ts";
import { computeAssistBonus } from "./assist-bonus.ts";
import { describeDungeonModifiers, type ResolvedDungeonModifiers } from "./dungeon-modifiers.ts";
import { maxMonsterLevel, SKILL_VOICE_AWAKENING_ID } from "./level-scaling.ts";
import {
  ASSIST_RESONANCE_ID,
  assistResonanceApplies,
  grantedAssistAwakenings,
  SELF_RELIANCE_ID,
  UNCONDITIONAL_PASSIVE_AWAKENING_IDS,
} from "./passive-awakenings.ts";
import { BADGE_OPTIONS, BADGE_TEAM_PCT } from "./stat-reference.ts";
import type { TeamBuildConfig, TeamMemberConfig } from "./types.ts";

export type ContributionSource =
  | "card"
  | "sync"
  | "super"
  | "assist"
  | "team"
  | "dungeon"
  | "leader"
  | "badge";

export type StatContribution = {
  /** Awakening id, or 0 for non-awakening rows (assist bonus, badge, dungeon). */
  id: number;
  source: ContributionSource;
  name: string;
  /** Short effect text, e.g. "+3000 HP", "×1.5 all stats", "Team HP +5 % × 15". */
  effect: string;
  active: boolean;
  /** Why it is inactive, or extra detail. */
  note?: string;
  copies?: number;
};

const LEVITATION_ID = 106;
const DUNGEON_CONDITIONAL_IDS = [128, 129, 30, 130, LEVITATION_ID];

function awkName(id: number): string {
  return AWAKENING_MULTIPLIERS[id]?.name ?? `Awakening #${id}`;
}

function countBy(ids: number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

function statText(hp?: number, atk?: number, rcv?: number): string {
  const h = hp ?? 1;
  const a = atk ?? 1;
  const r = rcv ?? 1;
  if (h === a && a === r) return `×${h} all stats`;
  const parts: string[] = [];
  if (h !== 1) parts.push(`HP ×${h}`);
  if (a !== 1) parts.push(`ATK ×${a}`);
  if (r !== 1) parts.push(`RCV ×${r}`);
  return parts.join(", ") || "—";
}

function flatText(id: number, copies: number): string {
  const def = AWAKENING_MULTIPLIERS[id];
  const f = def?.flat ?? {};
  const parts: string[] = [];
  if (f.hp) parts.push(`+${(f.hp * copies).toLocaleString()} HP`);
  if (f.atk) parts.push(`+${(f.atk * copies).toLocaleString()} ATK`);
  if (f.rcv) parts.push(`+${(f.rcv * copies).toLocaleString()} RCV`);
  return parts.join(", ");
}

export type SlotContributionInput = {
  member: TeamMemberConfig;
  row: MonsterRecord;
  eq: MonsterRecord | null;
  config: TeamBuildConfig;
  dungeon: ResolvedDungeonModifiers;
  /** Regular awakenings of every member plus those granted by their assists. */
  teamAwakenings: number[];
  /** Leader-skill multiplier resolved for this member. */
  leaderMult: { hp: number; rcv: number };
};

/** Everything that changes this slot's HP / ATK / RCV, in pipeline order. */
export function describeSlotContributions(
  input: SlotContributionInput
): StatContribution[] {
  const { member, row, eq, config, dungeon, teamAwakenings, leaderMult } = input;
  const out: StatContribution[] = [];
  const regular = parseRegularAwakenings(row.awakenings);
  const sync = Number(row.sync_awsid);
  const hasSync = Number.isFinite(sync) && sync > 0;
  const granted = grantedAssistAwakenings(eq);
  const settings: AwkModifierSettings = dungeon.awkSettings;

  // Skill Voice: ×1.1 on the Lv.99 base.
  if (regular.includes(SKILL_VOICE_AWAKENING_ID) || sync === SKILL_VOICE_AWAKENING_ID) {
    out.push({
      id: SKILL_VOICE_AWAKENING_ID,
      source: regular.includes(SKILL_VOICE_AWAKENING_ID) ? "card" : "sync",
      name: awkName(SKILL_VOICE_AWAKENING_ID),
      effect: "×1.1 base stats (before level / +points)",
      active: true,
    });
  }

  // Flat awakenings on the card and from the assist.
  for (const [ids, source] of [
    [regular, "card"],
    [granted, "assist"],
  ] as const) {
    for (const [id, copies] of countBy(ids)) {
      const def = AWAKENING_MULTIPLIERS[id];
      if (def?.kind !== "flat") continue;
      out.push({ id, source, name: def.name, effect: flatText(id, copies), active: true, copies });
    }
  }

  // Assist bonus.
  if (eq) {
    const bonus = computeAssistBonus(
      row,
      eq,
      maxMonsterLevel(eq),
      member.eqPlusHp,
      member.eqPlusRcv,
      member.eqPlusAtk ?? 0
    );
    const applies = bonus.hp > 0 || bonus.atk > 0 || bonus.rcv > 0;
    out.push({
      id: 0,
      source: "assist",
      name: "Assist stat bonus",
      effect: applies
        ? `+${bonus.hp.toLocaleString()} HP, +${bonus.atk.toLocaleString()} ATK, +${bonus.rcv.toLocaleString()} RCV (10 / 5 / 15 % of the assist)`
        : "+0 (needs the same main attribute)",
      active: applies,
      note: applies ? undefined : "Assist main attribute differs from the card",
    });
  }

  // Passive stat awakenings (card, sync, assist-granted unconditional ones).
  const passiveSlots: Array<[number, ContributionSource]> = [
    ...regular.map((id): [number, ContributionSource] => [id, "card"]),
    ...(hasSync ? ([[sync, "sync"]] as Array<[number, ContributionSource]>) : []),
    ...granted
      .filter((id) => (UNCONDITIONAL_PASSIVE_AWAKENING_IDS as readonly number[]).includes(id))
      .map((id): [number, ContributionSource] => [id, "assist"]),
  ];
  const seenPassive = new Map<string, StatContribution>();
  for (const [id, source] of passiveSlots) {
    const def = AWAKENING_MULTIPLIERS[id];
    if (!def || def.kind !== "stat") continue;
    if (id === SKILL_VOICE_AWAKENING_ID) continue; // listed above as the base multiplier
    if (DUNGEON_CONDITIONAL_IDS.includes(id)) continue; // handled below
    const key = `${id}:${source}`;
    const existing = seenPassive.get(key);
    if (existing) {
      existing.copies = (existing.copies ?? 1) + 1;
      continue;
    }
    let active = true;
    let note: string | undefined;
    if (id === ASSIST_RESONANCE_ID) {
      active = assistResonanceApplies(row, eq);
      note = active
        ? "Assist shares the main attribute and a type"
        : eq
          ? "Needs an assist with the same main attribute and a shared type"
          : "Needs an assist";
    } else if (id === SELF_RELIANCE_ID) {
      active = eq == null;
      note = active ? "No assist equipped" : "Only without an assist";
    }
    const entry: StatContribution = {
      id,
      source,
      name: def.name,
      effect: statText(def.hp, def.atk, def.rcv),
      active,
      note,
      copies: 1,
    };
    seenPassive.set(key, entry);
    out.push(entry);
  }

  // Selected super awakening.
  const sa = member.selectedSuperAwakening;
  if (sa != null && sa !== sync) {
    const def = AWAKENING_MULTIPLIERS[sa];
    if (def?.kind === "stat") {
      let active = true;
      let note: string | undefined;
      if (sa === ASSIST_RESONANCE_ID) {
        active = assistResonanceApplies(row, eq);
        note = active ? "Assist shares the main attribute and a type" : "Needs a matching assist";
      } else if (sa === SELF_RELIANCE_ID) {
        active = eq == null;
        note = active ? undefined : "Only without an assist";
      } else if (DUNGEON_CONDITIONAL_IDS.includes(sa)) {
        active = isAwkEnabled(sa, settings);
        note = active ? "Enabled by the dungeon" : "Needs the matching dungeon";
      }
      out.push({ id: sa, source: "super", name: def.name, effect: statText(def.hp, def.atk, def.rcv), active, note });
    } else if (def) {
      out.push({ id: sa, source: "super", name: def.name, effect: def.condition ?? "No team-screen stat effect", active: false, note: "Damage / utility awakening" });
    } else {
      out.push({ id: sa, source: "super", name: awkName(sa), effect: "No stat effect", active: false });
    }
  }

  // Dungeon-conditional awakenings on the card / sync (per copy).
  const condSlots = [...regular, ...(hasSync ? [sync] : [])];
  for (const [id, copies] of countBy(condSlots)) {
    if (!DUNGEON_CONDITIONAL_IDS.includes(id)) continue;
    const def = AWAKENING_MULTIPLIERS[id];
    if (!def) continue;
    const source: ContributionSource = regular.includes(id) ? "card" : "sync";
    if (id === LEVITATION_ID) {
      const superGravity = dungeon.entry?.superGravity != null || (dungeon.entry == null && dungeon.stat.atk > 0 && dungeon.stat.atk < 0.1);
      out.push({ id, source, name: def.name, effect: "ATK ×20 under super gravity", active: superGravity, note: superGravity ? undefined : "Only in super-gravity dungeons", copies });
      continue;
    }
    const active = isAwkEnabled(id, settings);
    const m = id === 130 ? (settings.agingBattle === 5 ? 1.5 : 2) : null;
    const effect = m != null ? `×${m} all stats${copies > 1 ? ` per copy (×${copies})` : ""}` : `${statText(def.hp, def.atk, def.rcv)}${copies > 1 ? ` per copy (×${copies})` : ""}`;
    out.push({
      id,
      source,
      name: def.name,
      effect,
      active,
      note: active ? "Enabled by the dungeon / advanced awakenings" : def.condition ?? "Needs the matching dungeon",
      copies,
    });
  }

  // Leader skill.
  if (leaderMult.hp !== 1 || leaderMult.rcv !== 1) {
    out.push({ id: 0, source: "leader", name: "Leader skills", effect: `HP ×${leaderMult.hp}, RCV ×${leaderMult.rcv}`, active: true });
  }

  // Dungeon stat modifiers.
  const chips = describeDungeonModifiers(dungeon.stat, { conditional: dungeon.conditional });
  if (chips.length) {
    out.push({ id: 0, source: "dungeon", name: dungeon.label, effect: chips.join(" · "), active: true });
  }

  // Team-level: Enhanced Team HP / RCV and badge (totals only).
  const teamCounts = countBy(teamAwakenings);
  for (const id of [46, 47]) {
    const copies = teamCounts.get(id) ?? 0;
    if (!copies) continue;
    const def = AWAKENING_MULTIPLIERS[id];
    const pct = def?.teamPct ?? {};
    const stat = pct.hp ? "HP" : "RCV";
    const per = pct.hp ?? pct.rcv ?? 0;
    out.push({ id, source: "team", name: def?.name ?? awkName(id), effect: `Team ${stat} +${per} % × ${copies} = +${per * copies} % (totals)`, active: true, copies });
  }
  if (config.badge !== "none") {
    const pct = BADGE_TEAM_PCT[config.badge];
    const label = BADGE_OPTIONS.find((b) => b.id === config.badge)?.label ?? config.badge;
    out.push({ id: 0, source: "badge", name: `Badge: ${label}`, effect: [pct.hp ? `HP +${pct.hp} %` : "", pct.atk ? `ATK +${pct.atk} %` : "", pct.rcv ? `RCV +${pct.rcv} %` : ""].filter(Boolean).join(", ") + " (totals)", active: true });
  }

  return out;
}

/** Ids on the card whose stat effect is currently active (for highlighting). */
export function activeStatAwakeningIds(contribs: StatContribution[]): Set<number> {
  const s = new Set<number>();
  for (const c of contribs) if (c.active && c.id > 0 && c.source !== "team") s.add(c.id);
  return s;
}

/** Ids on the card that could affect stats but are inactive right now. */
export function inactiveStatAwakeningIds(contribs: StatContribution[]): Set<number> {
  const s = new Set<number>();
  for (const c of contribs) if (!c.active && c.id > 0) s.add(c.id);
  return s;
}
