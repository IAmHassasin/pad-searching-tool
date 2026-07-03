import type { MonsterRecord } from "../types";
import {
  computeModifiedStat,
  type AwkModifierSettings,
} from "./awakening-stat-modifier";

export type ResultSortOption =
  | "default"
  | "cd_fastest"
  | "cd_longest"
  | "hp_modified"
  | "atk_modified"
  | "rcv_modified";

export const RESULT_SORT_OPTIONS: {
  value: ResultSortOption;
  label: string;
  needsAwkModifier: boolean;
}[] = [
  { value: "default", label: "Default (NA ID)", needsAwkModifier: false },
  { value: "cd_fastest", label: "Fastest CD", needsAwkModifier: false },
  { value: "cd_longest", label: "Longest CD", needsAwkModifier: false },
  { value: "hp_modified", label: "HP (awk modifier)", needsAwkModifier: true },
  {
    value: "atk_modified",
    label: "ATK (awk modifier)",
    needsAwkModifier: true,
  },
  {
    value: "rcv_modified",
    label: "RCV (awk modifier)",
    needsAwkModifier: true,
  },
];

function defaultTiebreak(a: MonsterRecord, b: MonsterRecord): number {
  const naA = a.monster_no_na;
  const naB = b.monster_no_na;
  if (naA == null && naB == null) return 0;
  if (naA == null) return 1;
  if (naB == null) return -1;
  return naB - naA;
}

function compareCooldown(
  a: MonsterRecord,
  b: MonsterRecord,
  mode: "fastest" | "longest"
): number {
  const valA =
    mode === "fastest"
      ? a.active_skill_cooldown_min ?? a.active_skill_cooldown_max
      : a.active_skill_cooldown_max ?? a.active_skill_cooldown_min;
  const valB =
    mode === "fastest"
      ? b.active_skill_cooldown_min ?? b.active_skill_cooldown_max
      : b.active_skill_cooldown_max ?? b.active_skill_cooldown_min;

  if (valA == null && valB == null) return defaultTiebreak(a, b);
  if (valA == null) return 1;
  if (valB == null) return -1;
  if (valA !== valB) {
    return mode === "fastest" ? valA - valB : valB - valA;
  }
  return defaultTiebreak(a, b);
}

export function sortMonsterRows(
  rows: MonsterRecord[],
  sort: ResultSortOption,
  awkSettings: AwkModifierSettings
): MonsterRecord[] {
  if (sort === "default") {
    return [...rows].sort(defaultTiebreak);
  }

  const statKey =
    sort === "hp_modified"
      ? "hp"
      : sort === "atk_modified"
        ? "atk"
        : sort === "rcv_modified"
          ? "rcv"
          : null;

  return [...rows].sort((a, b) => {
    if (sort === "cd_fastest") return compareCooldown(a, b, "fastest");
    if (sort === "cd_longest") return compareCooldown(a, b, "longest");
    if (statKey) {
      const va = computeModifiedStat(a, awkSettings, statKey);
      const vb = computeModifiedStat(b, awkSettings, statKey);
      if (va !== vb) return vb - va;
    }
    return defaultTiebreak(a, b);
  });
}

export function needsAwkModifierForSort(sort: ResultSortOption): boolean {
  return sort === "hp_modified" || sort === "atk_modified" || sort === "rcv_modified";
}
