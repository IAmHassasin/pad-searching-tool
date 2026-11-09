import type { DungeonFloorSummary } from "../../dungeon-details/types.ts";
import type { MonsterRecord } from "../../types.ts";
import { computeTeamStats } from "./compute-stats.ts";
import type { ResolvedDungeonModifiers } from "./dungeon-modifiers.ts";
import type { TeamBuildConfig } from "./types.ts";

/** Aging (熟成, "barrel"): ×1.5 from floor 5, ×2 from floor 10. */
export const AGING_AWAKENING_ID = 130;
export const AGING_FIRST_FLOOR = 5;
export const AGING_SECOND_FLOOR = 10;
/** A floor is "heavy" when its hardest hit is at least this share of the dungeon's. */
export const HEAVY_FLOOR_SHARE = 0.5;

export type AgingStage = 0 | 5 | 10;

export function agingStageForFloor(floor: number | null): AgingStage {
  if (floor == null) return 0;
  if (floor >= AGING_SECOND_FLOOR) return 10;
  if (floor >= AGING_FIRST_FLOOR) return 5;
  return 0;
}

/** Battle state that changes team stats between floors. */
export type FloorState = { aging: AgingStage; partsBroken: number };

export type TeamHpAt = (state: FloorState) => number;

/**
 * Team HP for a floor state: the dungeon's awakening settings with Aging set by floor
 * (instead of the manual toggle) and the cumulative broken parts.
 */
export function teamHpAtState(
  config: TeamBuildConfig,
  monstersById: Map<number, MonsterRecord>,
  dungeon: ResolvedDungeonModifiers,
  state: FloorState
): number {
  const enabled = dungeon.awkSettings.enabled.filter((id) => id !== AGING_AWAKENING_ID);
  if (state.aging > 0) enabled.push(AGING_AWAKENING_ID);
  const atFloor: ResolvedDungeonModifiers = {
    ...dungeon,
    awkSettings: {
      ...dungeon.awkSettings,
      enabled,
      agingBattle: state.aging === 5 ? 5 : 10,
    },
  };
  return computeTeamStats({ ...config, partsBroken: state.partsBroken }, monstersById, atFloor)
    .teamHp;
}

/** Default broken parts per floor: every part on numbered floors, none on 乱入 (position unknown). */
export function defaultPartsBroken(floors: readonly DungeonFloorSummary[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const f of floors) {
    if (f.partCount) out.set(f.index, f.floor == null ? 0 : f.partCount);
  }
  return out;
}

function brokenOn(f: DungeonFloorSummary, partsBroken: ReadonlyMap<number, number>): number {
  if (!f.partCount) return 0;
  const n = partsBroken.get(f.index) ?? 0;
  return Math.max(0, Math.min(f.partCount, Math.trunc(n)));
}

/**
 * Parts broken before a floor is fought: every earlier numbered floor in table order,
 * plus 乱入 parts (they can appear on any floor, so they count everywhere once set).
 */
export function partsBrokenBefore(
  floors: readonly DungeonFloorSummary[],
  target: DungeonFloorSummary,
  partsBroken: ReadonlyMap<number, number>
): number {
  let n = 0;
  for (const f of floors) {
    if (f.floor == null) {
      if (f.index !== target.index) n += brokenOn(f, partsBroken);
      continue;
    }
    if (f.index < target.index) n += brokenOn(f, partsBroken);
  }
  return n;
}

export function floorState(
  floors: readonly DungeonFloorSummary[],
  target: DungeonFloorSummary,
  partsBroken: ReadonlyMap<number, number>
): FloorState {
  return {
    aging: agingStageForFloor(target.floor),
    partsBroken: partsBrokenBefore(floors, target, partsBroken),
  };
}

export type HpTimelineRow = {
  /** First floor of the stretch with this HP. */
  fromLabel: string;
  fromIndex: number;
  hp: number;
  state: FloorState;
  /** What changed compared with the previous row ("Aging ×1.5", "+2 parts after B5"). */
  reasons: string[];
};

/**
 * Team HP per stretch of floors: one row for the first floor, then one wherever HP
 * changes (Aging threshold or parts broken on the floor before). 乱入 floors are left
 * out; their hits use the state of the first floor.
 */
export function buildHpTimeline(
  floors: readonly DungeonFloorSummary[],
  partsBroken: ReadonlyMap<number, number>,
  hpAt: TeamHpAt
): HpTimelineRow[] {
  const rows: HpTimelineRow[] = [];
  const cache = new Map<string, number>();
  const hpFor = (s: FloorState) => {
    const key = `${s.aging}:${s.partsBroken}`;
    let v = cache.get(key);
    if (v == null) {
      v = hpAt(s);
      cache.set(key, v);
    }
    return v;
  };
  let prevFloor: DungeonFloorSummary | null = null;
  for (const f of floors) {
    if (f.floor == null) continue;
    const state = floorState(floors, f, partsBroken);
    const hp = hpFor(state);
    const last = rows[rows.length - 1];
    if (!last) {
      rows.push({ fromLabel: f.label, fromIndex: f.index, hp, state, reasons: [] });
    } else if (hp !== last.hp) {
      const reasons: string[] = [];
      if (state.aging !== last.state.aging) {
        reasons.push(`Aging ×${state.aging === 10 ? 2 : 1.5}`);
      }
      const newParts = state.partsBroken - last.state.partsBroken;
      if (newParts > 0) {
        reasons.push(
          `+${newParts} part${newParts === 1 ? "" : "s"}${prevFloor ? ` after ${prevFloor.label}` : ""}`
        );
      }
      rows.push({ fromLabel: f.label, fromIndex: f.index, hp, state, reasons });
    }
    prevFloor = f;
  }
  return rows;
}

/** Floors whose hardest hit is at least half of the dungeon's hardest hit, in table order. */
export function heavyFloors(
  floors: readonly DungeonFloorSummary[],
  share = HEAVY_FLOOR_SHARE
): DungeonFloorSummary[] {
  const max = Math.max(0, ...floors.map((f) => f.maxHit?.value ?? 0));
  if (max <= 0) return [];
  return floors.filter((f) => (f.maxHit?.value ?? 0) >= max * share);
}

/** Team HP when a floor is fought (乱入: first-floor state plus 乱入 parts from other entries). */
export function teamHpOnFloor(
  floors: readonly DungeonFloorSummary[],
  target: DungeonFloorSummary,
  partsBroken: ReadonlyMap<number, number>,
  hpAt: TeamHpAt
): { hp: number; state: FloorState } {
  const state = floorState(floors, target, partsBroken);
  return { hp: hpAt(state), state };
}

/** True when the imported floor table can drive the per-floor checks (it lists hits). */
export function hasUsableFloorTable(
  floors: readonly DungeonFloorSummary[] | null | undefined
): floors is readonly DungeonFloorSummary[] {
  return (floors ?? []).some((f) => f.maxHit != null);
}

/**
 * Parts broken over the whole dungeon (every floor, 乱入 included): the count the
 * team totals use when the floor table drives Part Break Bonus.
 */
export function totalPartsBroken(
  floors: readonly DungeonFloorSummary[],
  partsBroken: ReadonlyMap<number, number>
): number {
  return floors.reduce((n, f) => n + brokenOn(f, partsBroken), 0);
}
