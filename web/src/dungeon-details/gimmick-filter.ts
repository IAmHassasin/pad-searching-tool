import type { DungeonSpawnEffect } from "./types";

/** Which part of a spawn's script the gimmick filter looks at. */
export type GimmickScope = "pre" | "super-resolve" | "all";

/** On entry, the Super Resolve trigger block, or a later conditional moveset. */
export type EffectPhase = "pre" | "super-resolve" | "moveset";

const BRACKET_LINE = /^【([^】]+)】$/;

/**
 * Bracket lines that describe the spawn itself. They stay in the current
 * phase (usually on-entry) instead of starting a later moveset.
 */
function isPassiveMarker(tag: string): boolean {
  if (tag === "根性" || tag === "低確率出現" || tag === "先制なし") return true;
  return tag.startsWith("超根性：") || tag.startsWith("超根性:");
}

/**
 * Walk effect lines in order. Lines before the first action header are the
 * on-entry kit. 【超根性発動時】 starts the Super Resolve block until the
 * next action header.
 */
export function classifyEffects(
  effects: Pick<DungeonSpawnEffect, "raw">[],
): EffectPhase[] {
  const phases: EffectPhase[] = [];
  let phase: EffectPhase = "pre";
  for (const effect of effects) {
    const tag = effect.raw.match(BRACKET_LINE)?.[1]?.trim();
    if (tag) {
      if (tag.includes("超根性発動")) phase = "super-resolve";
      else if (!isPassiveMarker(tag)) phase = "moveset";
    }
    phases.push(phase);
  }
  return phases;
}

export function effectInScope(phase: EffectPhase, scope: GimmickScope): boolean {
  if (scope === "all") return true;
  if (scope === "pre") return phase === "pre";
  return phase === "super-resolve";
}

export function floorMatchCount(
  spawns: { effects: Pick<DungeonSpawnEffect, "raw" | "gimmickIds">[] }[],
  gimmickId: string | null,
  scope: GimmickScope,
): number {
  if (!gimmickId) return spawns.length;
  return spawns.filter((spawn) => spawnHasGimmick(spawn.effects, gimmickId, scope))
    .length;
}

/** A floor is dim only when every spawn misses the selected gimmick. */
export function floorIsDim(
  spawns: { effects: Pick<DungeonSpawnEffect, "raw" | "gimmickIds">[] }[],
  gimmickId: string | null,
  scope: GimmickScope,
): boolean {
  return gimmickId != null && spawns.length > 0 && floorMatchCount(spawns, gimmickId, scope) === 0;
}

export function spawnHasGimmick(
  effects: Pick<DungeonSpawnEffect, "raw" | "gimmickIds">[],
  gimmickId: string,
  scope: GimmickScope,
): boolean {
  const phases = classifyEffects(effects);
  return effects.some(
    (effect, index) =>
      effectInScope(phases[index] ?? "pre", scope) &&
      effect.gimmickIds.includes(gimmickId),
  );
}
