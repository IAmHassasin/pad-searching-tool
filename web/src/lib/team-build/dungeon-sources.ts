import type { DungeonMaxDamage, DungeonSummary } from "../../dungeon-details/types.ts";
import { stripPadTitle } from "../../dungeon-details/utils.ts";
import type { DungeonCatalogEntry } from "./dungeon-catalog-types.ts";

/** Hardest hit of an entry plus where it came from. */
export type ResolvedMaxHit = DungeonMaxDamage & {
  source: "floor-table" | "appmedia" | "kamigame";
  sourceUrl: string;
};

/**
 * One dungeon list for the picker and the trial.
 *
 * The static catalog carries the stat modifiers; the Dungeon details seeds
 * (AppMedia floor tables) carry the hardest hit. Catalog entries link to a
 * seed through `appmediaPostId`; seeds the catalog does not know yet are
 * appended as neutral entries so they can still be picked and trialled.
 */

export const APPMEDIA_ENTRY_PREFIX = "appmedia-";
export const APPMEDIA_ONLY_CATEGORY = "Floor table only (AppMedia)";
export const APPMEDIA_ONLY_NOTE = "stat modifiers unknown — floor table only";

/** "Phoenix Challenge — counters & recommended teams | Roaring Phoenix Emperor" → "Phoenix Challenge · Roaring Phoenix Emperor". */
export function shortDungeonTitle(d: Pick<DungeonSummary, "titleEn" | "titleJa">): string {
  const base = d.titleEn?.trim() || stripPadTitle(d.titleJa);
  // ASCII "|" in translated titles, full-width "｜" in the JP original.
  const [head, tail] = base.split(/\s*[|｜]\s*/);
  const name = head.split(/\s+[—–-]\s+/)[0].trim();
  return tail ? `${name} · ${tail.trim()}` : name;
}

export function entryForSeed(seed: DungeonSummary): DungeonCatalogEntry {
  return {
    id: `${APPMEDIA_ENTRY_PREFIX}${seed.appmediaPostId}`,
    nameJa: stripPadTitle(seed.titleJa),
    nameEn: shortDungeonTitle(seed),
    category: APPMEDIA_ONLY_CATEGORY,
    sun: false,
    moon: false,
    multiplayer: false,
    maxFloor: null,
    stat: { hp: 1, atk: 1, rcv: 1 },
    superGravity: null,
    sourceUrl: seed.sourceUrl,
    appmediaPostId: seed.appmediaPostId,
    notes: APPMEDIA_ONLY_NOTE,
  };
}

export function mergeDungeonSources(
  catalog: DungeonCatalogEntry[],
  seeds: DungeonSummary[]
): DungeonCatalogEntry[] {
  const linked = new Set<number>();
  for (const e of catalog) if (e.appmediaPostId) linked.add(e.appmediaPostId);
  const extra = seeds
    .filter((s) => !linked.has(s.appmediaPostId))
    .map(entryForSeed);
  return extra.length ? [...catalog, ...extra] : catalog;
}

export function seedForEntry(
  entry: DungeonCatalogEntry | null | undefined,
  seedsByPostId: Map<number, DungeonSummary>
): DungeonSummary | null {
  if (!entry?.appmediaPostId) return null;
  return seedsByPostId.get(entry.appmediaPostId) ?? null;
}

/**
 * Hardest hit for an entry: the imported floor table wins, otherwise the
 * value scraped into the catalog (`maxHit`).
 */
export function maxHitForEntry(
  entry: DungeonCatalogEntry | null | undefined,
  seedsByPostId: Map<number, DungeonSummary>
): ResolvedMaxHit | null {
  const seed = seedForEntry(entry, seedsByPostId);
  if (seed?.maxDamage) {
    return { ...seed.maxDamage, source: "floor-table", sourceUrl: seed.sourceUrl };
  }
  const hit = entry?.maxHit;
  if (!hit || !(hit.value > 0)) return null;
  return {
    value: hit.value,
    floor: hit.floor ?? null,
    monsterId: null,
    monsterNameJa: hit.monsterNameJa ?? null,
    raw: hit.raw,
    source: hit.source,
    sourceUrl: hit.sourceUrl,
  };
}
