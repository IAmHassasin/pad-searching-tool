import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchDungeonList } from "../dungeon-details/api";
import type { DungeonSummary } from "../dungeon-details/types";
import { DUNGEON_CATALOG_ENTRIES } from "../lib/team-build/dungeon-catalog";
import type { DungeonCatalogEntry } from "../lib/team-build/dungeon-catalog";
import { mergeDungeonSources } from "../lib/team-build/dungeon-sources";

const NO_SEEDS: DungeonSummary[] = [];

/**
 * The single dungeon list used by the team build picker and the trial:
 * static catalog (stat modifiers) merged with the imported floor tables
 * (hardest hit). The catalog alone is served until the list request settles,
 * so the page never waits on the API.
 */
export function useDungeonEntries(): {
  entries: DungeonCatalogEntry[];
  seedsByPostId: Map<number, DungeonSummary>;
  listStatus: "pending" | "error" | "success";
  listError: string | null;
} {
  const list = useQuery({
    queryKey: ["dungeon-details", "list"],
    queryFn: fetchDungeonList,
    staleTime: 5 * 60 * 1000,
  });
  const seeds = list.data?.dungeons ?? NO_SEEDS;
  const entries = useMemo(
    () => mergeDungeonSources(DUNGEON_CATALOG_ENTRIES, seeds),
    [seeds]
  );
  const seedsByPostId = useMemo(
    () => new Map(seeds.map((s) => [s.appmediaPostId, s] as const)),
    [seeds]
  );
  return {
    entries,
    seedsByPostId,
    listStatus: list.status,
    listError: list.error instanceof Error ? list.error.message : null,
  };
}
