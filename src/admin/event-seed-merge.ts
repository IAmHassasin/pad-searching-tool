export type EventSeedEntry = {
  monsterId: number;
  role: "new-monster" | "new-evolution" | "returning";
  label?: string;
  note?: string;
};

export type EventSeedFile = {
  eventId: string;
  title: string;
  subtitle?: string | null;
  publishedAt?: string | null;
  sourceUrl?: string | null;
  groupId?: number | null;
  coverMonsterIds?: number[];
  entries: EventSeedEntry[];
  loading?: { theme: string; minMs?: number; asset?: string };
};

export type MonsterNameRow = { monsterId: number; nameEn: string };

const COVER_CAP = 6;

export function resolveMonsterIdByName(
  name: string,
  catalog: MonsterNameRow[]
): number | null {
  const exact = pickHighest(
    catalog.filter(
      (row) => row.nameEn.trim().toLowerCase() === name.trim().toLowerCase()
    )
  );
  if (exact != null) return exact;

  const comma = name.lastIndexOf(",");
  if (comma < 0) return null;
  const short = name.slice(comma + 1).trim();
  if (!short) return null;
  return pickHighest(
    catalog.filter(
      (row) => row.nameEn.trim().toLowerCase() === short.toLowerCase()
    )
  );
}

export function mergeEventSeed(
  existing: EventSeedFile,
  incoming: { sourceUrl?: string; monsterIds: number[]; groupId?: number | null }
): EventSeedFile {
  const have = new Set(existing.entries.map((e) => e.monsterId));
  const entries = [...existing.entries];
  for (const monsterId of incoming.monsterIds) {
    if (have.has(monsterId)) continue;
    have.add(monsterId);
    entries.push({
      monsterId,
      role: "new-evolution",
      label: "New Evolution",
    });
  }

  const covers = [...(existing.coverMonsterIds ?? [])];
  for (const monsterId of incoming.monsterIds) {
    if (covers.includes(monsterId)) continue;
    covers.push(monsterId);
  }

  return {
    ...existing,
    entries,
    coverMonsterIds: covers.slice(0, COVER_CAP),
    groupId: incoming.groupId ?? existing.groupId ?? null,
  };
}

export function createEventSeed(opts: {
  eventId: string;
  title: string;
  sourceUrl: string;
  publishedAt?: string | null;
  monsterIds: number[];
  groupId?: number | null;
}): EventSeedFile {
  return {
    eventId: opts.eventId,
    title: opts.title,
    subtitle: null,
    publishedAt: opts.publishedAt ?? new Date().toISOString().slice(0, 10),
    sourceUrl: opts.sourceUrl,
    groupId: opts.groupId ?? null,
    coverMonsterIds: opts.monsterIds.slice(0, COVER_CAP),
    loading: { theme: "fade", minMs: 700 },
    entries: opts.monsterIds.map((monsterId) => ({
      monsterId,
      role: "new-evolution" as const,
      label: "New Evolution",
    })),
  };
}

function pickHighest(rows: MonsterNameRow[]): number | null {
  if (!rows.length) return null;
  return Math.max(...rows.map((r) => r.monsterId));
}
