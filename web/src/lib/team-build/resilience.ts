import type { MonsterRecord } from "../../types.ts";
import type { TeamBuildConfig } from "./types.ts";

/**
 * Trial mode — "Resilience" check: can the team take the hardest hit of a
 * dungeon (AppMedia preemptive table, `maxDamage`) at full HP?
 *
 *   effective max HP = team HP (LS HP × badge × dungeon, see compute-stats)
 *                      × active HP buff (one at a time)
 *   damage taken     = max hit × Π(1 − leader shield) × (1 − active shield)
 *   survives         = damage taken < effective max HP
 *
 * Shields multiply (PAD stacks leader skill and active damage reduction
 * multiplicatively); HP buffs from actives never stack, so the UI lets the
 * user pick at most one HP buff and one shield.
 */

export type DefensiveEffectKind = "shield" | "hp";

export type ActiveDefensiveEffect = {
  kind: DefensiveEffectKind;
  /** Shield: damage reduction 0..1. HP: max HP multiplier (> 1). */
  value: number;
  /** Duration in turns; null when the text does not say. */
  turns: number | null;
  /** 1-based stage of an evolving / random-list active; null otherwise. */
  stage: number | null;
};

export type DefensiveOption = {
  /** Stable key for the UI (slot + source + effect). */
  id: string;
  slotIndex: number;
  source: "card" | "assist";
  monsterId: number;
  monsterName: string;
  skillName: string;
  effect: ActiveDefensiveEffect;
};

export type ResilienceInput = {
  /** Team total HP from compute-stats (already includes LS HP, badge, dungeon). */
  teamHp: number;
  /** Leader-skill damage reductions (0..1) that should count, e.g. [0.5, 0.25]. */
  leaderShields: number[];
  /** Active HP multiplier (> 1) or null. */
  hpBuff: number | null;
  /** Active damage reduction (0..1) or null. */
  activeShield: number | null;
  /** Hardest hit of the dungeon; null when unknown. */
  maxDamage: number | null;
};

export type ResilienceResult = {
  /** teamHp × hpBuff. */
  effectiveMaxHp: number;
  /** Combined reduction from every shield, 0..1. */
  totalReduction: number;
  /** effectiveMaxHp / (1 − totalReduction); Infinity for a 100 % shield. */
  effectiveHp: number;
  /** maxDamage × (1 − totalReduction); null without a dungeon value. */
  damageTaken: number | null;
  /** null without a dungeon value. */
  survives: boolean | null;
  /** effectiveMaxHp − damageTaken (positive = HP left); null without a dungeon value. */
  margin: number | null;
};

// "For 1 turn, reduce damage taken by 75%" / "reduce damage taken by 100%"
const SHIELD_RE = /reduce damage taken by (\d+(?:\.\d+)?)%/i;
// "For 2 turns, 4x HP" / "1.2x HP" / "2x HP & RCV" / "1.5x all stats"
const HP_RE = /(\d+(?:\.\d+)?)x (?:HP(?: & RCV)?|all stats)(?![\w%])/i;
const TURNS_RE = /for (\d+) turns?/i;
// Stage markers of evolving / random-list actives: "1) … 2) …"
const STAGE_RE = /(?:^|\s)(\d+)\)\s/g;

function clampShield(pct: number): number | null {
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return Math.min(1, pct / 100);
}

// "reduce damage taken by 8% for each Skill Boost on the team": the value
// scales with the team, so the clause is not a flat effect and is skipped.
const PER_UNIT_RE = /\bfor (?:each|every)\b/i;

function parseClause(clause: string, stage: number | null): ActiveDefensiveEffect[] {
  const out: ActiveDefensiveEffect[] = [];
  if (PER_UNIT_RE.test(clause)) return out;
  const turnsMatch = clause.match(TURNS_RE);
  const turns = turnsMatch ? Number(turnsMatch[1]) : null;

  const shield = clause.match(SHIELD_RE);
  if (shield) {
    const value = clampShield(Number(shield[1]));
    if (value != null) out.push({ kind: "shield", value, turns, stage });
  }

  const hp = clause.match(HP_RE);
  if (hp) {
    const value = Number(hp[1]);
    if (Number.isFinite(value) && value > 1) {
      out.push({ kind: "hp", value, turns, stage });
    }
  }
  return out;
}

function splitStages(desc: string): Array<{ stage: number | null; text: string }> {
  const markers = [...desc.matchAll(STAGE_RE)];
  if (markers.length < 2) return [{ stage: null, text: desc }];
  const parts: Array<{ stage: number | null; text: string }> = [];
  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index ?? desc.length : desc.length;
    parts.push({ stage: Number(m[1]), text: desc.slice(start, end) });
  }
  return parts;
}

/**
 * Shield / HP-buff effects in an English active skill description
 * (dadguide `active_skills.desc_en`). Each clause ("; "-separated) is read on
 * its own, so "For 1 turn, 2.5x HP; For 2 turns, reduce damage taken by 50%"
 * yields two effects; evolving actives tag each effect with its stage.
 * Duplicates (same kind / value / turns / stage) are dropped.
 */
export function parseActiveDefensiveEffects(
  desc: string | null | undefined
): ActiveDefensiveEffect[] {
  const text = desc?.trim();
  if (!text) return [];
  const out: ActiveDefensiveEffect[] = [];
  const seen = new Set<string>();
  for (const { stage, text: stageText } of splitStages(text)) {
    for (const clause of stageText.split(/;\s*/)) {
      for (const effect of parseClause(clause, stage)) {
        const key = `${effect.kind}:${effect.value}:${effect.turns}:${effect.stage}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(effect);
      }
    }
  }
  return out;
}

function parseId(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Every shield / HP-buff active on the team: each slot's card and its assist
 * (the assist's active replaces the card's in game, both are listed so the
 * user can pick either). Options keep their slot index; the UI labels it.
 */
export function listDefensiveOptions(
  config: TeamBuildConfig,
  monstersById: Map<number, MonsterRecord>
): DefensiveOption[] {
  const out: DefensiveOption[] = [];
  config.members.forEach((member, slotIndex) => {
    const sources: Array<{ source: DefensiveOption["source"]; id: number | null }> = [
      { source: "card", id: parseId(member.monsterId) },
      { source: "assist", id: parseId(member.eqId) },
    ];
    for (const { source, id } of sources) {
      if (!id) continue;
      const row = monstersById.get(id);
      if (!row) continue;
      const effects = parseActiveDefensiveEffects(row.active_skill_desc_en);
      effects.forEach((effect, i) => {
        out.push({
          id: `${slotIndex}-${source}-${effect.kind}-${i}`,
          slotIndex,
          source,
          monsterId: id,
          monsterName: row.name_en?.trim() || `#${id}`,
          skillName: row.active_skill_name_en?.trim() || "",
          effect,
        });
      });
    }
  });
  return out;
}

/** Leader-skill max damage reduction (0..1) of a card; 0 when unknown. */
export function leaderShieldOf(row: MonsterRecord | null | undefined): number {
  const n = Number(row?.leader_skill_max_shield ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(1, n);
}

export function computeResilience(input: ResilienceInput): ResilienceResult {
  const hpBuff = input.hpBuff != null && input.hpBuff > 1 ? input.hpBuff : 1;
  const effectiveMaxHp = Math.round(Math.max(0, input.teamHp) * hpBuff);

  let remaining = 1;
  for (const s of input.leaderShields) {
    if (Number.isFinite(s) && s > 0) remaining *= 1 - Math.min(1, s);
  }
  if (input.activeShield != null && input.activeShield > 0) {
    remaining *= 1 - Math.min(1, input.activeShield);
  }
  const totalReduction = 1 - remaining;
  const effectiveHp = remaining > 0 ? effectiveMaxHp / remaining : Infinity;

  const maxDamage =
    input.maxDamage != null && Number.isFinite(input.maxDamage) && input.maxDamage > 0
      ? input.maxDamage
      : null;
  if (maxDamage == null) {
    return {
      effectiveMaxHp,
      totalReduction,
      effectiveHp,
      damageTaken: null,
      survives: null,
      margin: null,
    };
  }
  const damageTaken = Math.round(maxDamage * remaining);
  return {
    effectiveMaxHp,
    totalReduction,
    effectiveHp,
    damageTaken,
    // Damage equal to max HP is lethal in PAD, so strictly less.
    survives: damageTaken < effectiveMaxHp,
    margin: effectiveMaxHp - damageTaken,
  };
}

/** Short label for an effect, e.g. "75% shield · 1 turn" / "4x HP · 2 turns · stage 2". */
export function describeDefensiveEffect(effect: ActiveDefensiveEffect): string {
  const head =
    effect.kind === "shield"
      ? `${Math.round(effect.value * 100)}% shield`
      : `${effect.value}x HP`;
  const parts = [head];
  if (effect.turns != null) parts.push(`${effect.turns} turn${effect.turns === 1 ? "" : "s"}`);
  if (effect.stage != null) parts.push(`stage ${effect.stage}`);
  return parts.join(" · ");
}
