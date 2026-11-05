import raw from "./dungeon-catalog.json";
import type { DungeonCatalog, DungeonCatalogEntry } from "./dungeon-catalog-types";

export type {
  DungeonCatalog,
  DungeonCatalogEntry,
  DungeonStatMultipliers,
} from "./dungeon-catalog-types";
export {
  CUSTOM_DUNGEON_ID,
  dungeonCategories,
  filterDungeonEntries,
  findDungeonEntry,
  NO_DUNGEON_ID,
} from "./dungeon-catalog-types";

/**
 * Static catalog (GameWith / AppMedia research, see `sources`). JSON lives in
 * its own module so the pure helpers stay importable from node tests.
 */
export const dungeonCatalog = raw as unknown as DungeonCatalog;

export const DUNGEON_CATALOG_ENTRIES: DungeonCatalogEntry[] = dungeonCatalog.dungeons;
