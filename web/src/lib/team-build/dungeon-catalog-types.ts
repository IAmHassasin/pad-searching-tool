/** Team-wide stat multipliers a dungeon applies on entry (1 = unchanged). */
export type DungeonStatMultipliers = {
  hp: number;
  atk: number;
  rcv: number;
};

/**
 * Stat boost limited to members of given types or attributes
 * (e.g. 回復タイプ強化 = healer HP ×1.5, 深緑 = wood ATK/RCV ×2).
 */
export type ConditionalStatBoost = {
  /** dadguide type ids (balance 1, physical 2, healer 3, dragon 4, god 5, attacker 6, devil 7, machine 8). */
  types?: number[];
  /** Attribute ids (fire 0 … dark 4); matches any of the member's attributes. */
  attributes?: number[];
  hp: number;
  atk: number;
  rcv: number;
};

export type DungeonCatalogEntry = {
  /** Stable slug used in `TeamBuildConfig.dungeonId`. */
  id: string;
  nameJa: string;
  nameEn: string;
  /** Grouping label for the picker (e.g. "Sun / Moon", "Stat down"). */
  category: string;
  /** Sun present → Yang Protection (128) is active. */
  sun: boolean;
  /** Moon present → Yin Protection (129) is active. */
  moon: boolean;
  /** Multiplayer dungeon → Multi Boost (30) is active. */
  multiplayer: boolean;
  /** Highest floor; drives Aging (130) B5 / B10 thresholds. Null = unknown. */
  maxFloor: number | null;
  stat: DungeonStatMultipliers;
  /** Super gravity damage factor (e.g. 0.01) — informational, see Levitation (106). */
  superGravity: number | null;
  /** Type / attribute limited boosts applied per member. */
  conditional?: ConditionalStatBoost[];
  sourceUrl: string;
  /**
   * AppMedia post id of the imported floor table for this dungeon
   * (Dungeon details) — carries the hardest hit used by the trial.
   */
  appmediaPostId?: number | null;
  /**
   * Hardest hit when no floor table is imported: scraped from a Kamigame
   * enemy table or an older AppMedia guide by
   * dungeon-details/scripts/resolve-catalog-max-hits.mjs.
   */
  maxHit?: DungeonMaxHit | null;
  notes?: string;
};

export type DungeonMaxHit = {
  value: number;
  raw: string;
  sourceUrl: string;
  source: "appmedia" | "kamigame";
  floor?: string | null;
  monsterNameJa?: string | null;
};

export type DungeonCatalog = {
  version: number;
  importedAt: string;
  sources: string[];
  dungeons: DungeonCatalogEntry[];
};

export const NO_DUNGEON_ID = "none";
export const CUSTOM_DUNGEON_ID = "custom";

export function findDungeonEntry(
  entries: DungeonCatalogEntry[],
  id: string
): DungeonCatalogEntry | null {
  return entries.find((d) => d.id === id) ?? null;
}

/** Unique categories in catalog order. */
export function dungeonCategories(entries: DungeonCatalogEntry[]): string[] {
  const out: string[] = [];
  for (const d of entries) if (!out.includes(d.category)) out.push(d.category);
  return out;
}

/** Case-insensitive match on JP / EN names and category. */
export function filterDungeonEntries(
  entries: DungeonCatalogEntry[],
  query: string
): DungeonCatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (d) =>
      d.nameEn.toLowerCase().includes(q) ||
      d.nameJa.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q)
  );
}
