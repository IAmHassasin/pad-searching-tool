import {
  collectSidebarDungeonPostIds,
  filterNewDungeonPostIds,
} from "./dungeon-catalog-parse.ts";

export type DungeonSyncFailed = { id: number; error: string };

export type DungeonSyncResult = {
  added: number[];
  failed: DungeonSyncFailed[];
  candidateCount: number;
};

export async function syncNewDungeons(opts: {
  fetchHomeHtml: () => Promise<string>;
  existingIds: number[];
  previouslyImportedIds?: number[];
  importDungeon: (id: number) => Promise<void>;
}): Promise<DungeonSyncResult> {
  const html = await opts.fetchHomeHtml();
  const cutoff = opts.existingIds.length
    ? Math.max(...opts.existingIds)
    : 0;
  const candidates = filterNewDungeonPostIds(
    collectSidebarDungeonPostIds(html),
    {
      cutoff,
      existingIds: opts.existingIds,
      previouslyImportedIds: opts.previouslyImportedIds,
    }
  );

  const added: number[] = [];
  const failed: DungeonSyncFailed[] = [];
  for (const id of candidates) {
    try {
      await opts.importDungeon(id);
      added.push(id);
    } catch (e: unknown) {
      failed.push({
        id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { added, failed, candidateCount: candidates.length };
}
