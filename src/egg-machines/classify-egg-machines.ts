import { createHash } from "node:crypto";

export const EGG_MACHINES_SINCE_UNIX = Math.floor(
  Date.parse("2026-01-01T00:00:00Z") / 1000
);

/** Pal, weekly Rare Egg Machine, and Video machines are not event cards. */
const EXCLUDED_MACHINE_TYPES = new Set([1, 2, 9]);

/**
 * A pool is a collab when at least this share of its cards belongs to a
 * collab or GungHo-collab series. Collab godfests stay under the line.
 */
const COLLAB_SHARE_NUMERATOR = 3;
const COLLAB_SHARE_DENOMINATOR = 10;

const BARE_SUPER_GODFEST = new Set([
  "super godfest",
  "seasonal super godfest",
  "スーパーゴッドフェス",
]);

export type EggServer = "JP" | "NA";

export type EggBadge = "JP" | "NA" | "Might skip";

export type EggCardRate = {
  monsterId: number;
  weight: number;
};

export type EggMachineInput = {
  serverId: number;
  name: string;
  start: number;
  end: number;
  cost: number;
  machineType: number;
  monsterIds: number[];
  /** Positive per-card weights from `egg_machines.contents`. Omitted on older callers. */
  rates?: EggCardRate[];
};

export type EggWindow = {
  server: EggServer;
  start: number;
  end: number;
  cost: number;
};

export type EggMachineEvent = {
  id: string;
  name: string;
  collab: boolean;
  windows: EggWindow[];
  badges: EggBadge[];
  jpOnlyIds: number[];
  sharedIds: number[];
  /** Rate table of the latest run on each server that has this pool. */
  rates: Partial<Record<EggServer, EggCardRate[]>>;
};

type Pool = {
  ids: number[];
  machines: EggMachineInput[];
};

function poolKey(ids: number[]): string {
  return ids.join(",");
}

export function eggPoolId(ids: number[]): string {
  return createHash("sha1").update(poolKey(ids)).digest("hex").slice(0, 12);
}

function uniqueSorted(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort(
    (a, b) => a - b
  );
}

function isBareSuperGodfest(name: string): boolean {
  return BARE_SUPER_GODFEST.has(name.trim().toLowerCase());
}

function serverOf(serverId: number): EggServer | null {
  if (serverId === 0) return "JP";
  if (serverId === 1) return "NA";
  return null;
}

function latestMachine(machines: EggMachineInput[], server: EggServer): EggMachineInput | null {
  const serverId = server === "JP" ? 0 : 1;
  const runs = machines.filter((machine) => machine.serverId === serverId);
  if (!runs.length) return null;
  return runs.reduce((best, run) => {
    if (run.start > best.start) return run;
    if (run.start === best.start && run.end > best.end) return run;
    return best;
  });
}

function latestWindow(machines: EggMachineInput[], server: EggServer): EggWindow | null {
  const latest = latestMachine(machines, server);
  if (!latest) return null;
  return {
    server,
    start: latest.start,
    end: latest.end,
    cost: latest.cost,
  };
}

function ratesFor(machines: EggMachineInput[]): Partial<Record<EggServer, EggCardRate[]>> {
  const rates: Partial<Record<EggServer, EggCardRate[]>> = {};
  for (const server of ["JP", "NA"] as const) {
    const latest = latestMachine(machines, server);
    if (latest) rates[server] = latest.rates ?? [];
  }
  return rates;
}

function maxStart(machines: EggMachineInput[], serverId: number): number | null {
  const starts = machines
    .filter((machine) => machine.serverId === serverId)
    .map((machine) => machine.start);
  if (!starts.length) return null;
  return Math.max(...starts);
}

function preferredName(machines: EggMachineInput[]): string {
  const ranked = [...machines].sort((a, b) => {
    if (a.serverId !== b.serverId) return a.serverId === 1 ? -1 : 1;
    return b.start - a.start;
  });
  return ranked[0]?.name.trim() || "Egg Machine";
}

function isCollabPool(ids: number[], collabIds: ReadonlySet<number>): boolean {
  let hits = 0;
  for (const id of ids) if (collabIds.has(id)) hits += 1;
  return hits * COLLAB_SHARE_DENOMINATOR >= ids.length * COLLAB_SHARE_NUMERATOR;
}

/**
 * Group JP and NA egg machines that share an exact monster pool.
 * Bare Super Godfests stay hidden unless they are marked Might skip.
 * Might skip applies only to collabs whose two preceding JP collabs already
 * reached NA with their own exact pools.
 */
export function classifyEggMachines(
  machines: EggMachineInput[],
  onNaIds: ReadonlySet<number>,
  _now: number,
  since = EGG_MACHINES_SINCE_UNIX,
  collabIds: ReadonlySet<number> = new Set()
): EggMachineEvent[] {
  const eligible = machines.filter((machine) => {
    if (serverOf(machine.serverId) == null) return false;
    if (EXCLUDED_MACHINE_TYPES.has(machine.machineType)) return false;
    return uniqueSorted(machine.monsterIds).length > 0;
  });

  const pools = new Map<string, Pool>();
  for (const machine of eligible) {
    const ids = uniqueSorted(machine.monsterIds);
    const key = poolKey(ids);
    const pool = pools.get(key) ?? { ids, machines: [] };
    pool.machines.push({
      ...machine,
      monsterIds: ids,
      name: machine.name.trim(),
      rates: machine.rates ?? [],
    });
    pools.set(key, pool);
  }

  const groups = [...pools.values()];
  const idSets = groups.map((group) => ({
    group,
    idSet: new Set(group.ids),
    hasJp: group.machines.some((machine) => machine.serverId === 0),
    hasNa: group.machines.some((machine) => machine.serverId === 1),
    collab: isCollabPool(group.ids, collabIds),
    maxJpStart: maxStart(group.machines, 0),
  }));

  const events: EggMachineEvent[] = [];
  for (const entry of idSets) {
    const inWindow = entry.group.machines.some((machine) => machine.start >= since);
    if (!inWindow) continue;

    const jpOnlyIds = entry.group.ids.filter((id) => !onNaIds.has(id));
    const sharedIds = entry.group.ids.filter((id) => onNaIds.has(id));
    const mightSkip = isMightSkip(entry, idSets);

    const bare = entry.group.machines.every((machine) =>
      isBareSuperGodfest(machine.name)
    );
    if (bare && !mightSkip) continue;

    const windows = (["JP", "NA"] as const)
      .map((server) => latestWindow(entry.group.machines, server))
      .filter((window): window is EggWindow => window != null);

    const badges: EggBadge[] = [];
    if (entry.hasJp) badges.push("JP");
    if (entry.hasNa) badges.push("NA");
    if (mightSkip) badges.push("Might skip");

    events.push({
      id: eggPoolId(entry.group.ids),
      name: preferredName(entry.group.machines),
      collab: entry.collab,
      windows,
      badges,
      jpOnlyIds,
      sharedIds,
      rates: ratesFor(entry.group.machines),
    });
  }

  events.sort((a, b) => {
    const aStart = Math.max(...a.windows.map((window) => window.start));
    const bStart = Math.max(...b.windows.map((window) => window.start));
    return bStart - aStart;
  });
  return events;
}

function isMightSkip(
  entry: {
    hasJp: boolean;
    hasNa: boolean;
    collab: boolean;
    maxJpStart: number | null;
  },
  groups: Array<{
    hasJp: boolean;
    hasNa: boolean;
    collab: boolean;
    maxJpStart: number | null;
  }>
): boolean {
  if (!entry.collab || !entry.hasJp || entry.hasNa || entry.maxJpStart == null) {
    return false;
  }
  const previous = groups
    .filter(
      (other) =>
        other !== entry &&
        other.collab &&
        other.hasJp &&
        other.maxJpStart != null &&
        other.maxJpStart < entry.maxJpStart!
    )
    .sort((a, b) => b.maxJpStart! - a.maxJpStart!)
    .slice(0, 2);
  return previous.length === 2 && previous.every((other) => other.hasNa);
}
