import {
  extractEventNameFromArticle,
  extractUpgradeMonsterNames,
  findRelatedEventUrl,
  listEvolutionArticleUrls,
  matchExistingEvent,
  matchGroupByEventName,
  slugifyEventId,
  type CollabGroupIdentity,
  type EventIdentity,
} from "./event-catalog-parse.ts";
import {
  createEventSeed,
  mergeEventSeed,
  resolveMonsterIdByName,
  type EventSeedFile,
  type MonsterNameRow,
} from "./event-seed-merge.ts";

export type EventSyncResult = {
  created: string[];
  skippedExisting: string[];
  unparsedArticles: number;
};

export async function syncNewEvents(opts: {
  fetchNewsHtml: () => Promise<string>;
  fetchArticleHtml: (url: string) => Promise<string>;
  listEvents: () => EventIdentity[];
  loadSeed: (eventId: string) => EventSeedFile | null;
  saveSeed: (seed: EventSeedFile) => void;
  catalog?: MonsterNameRow[];
  groups?: CollabGroupIdentity[];
}): Promise<EventSyncResult> {
  const newsHtml = await opts.fetchNewsHtml();
  const urls = listEvolutionArticleUrls(newsHtml);
  const catalog = opts.catalog ?? [];
  const groups = opts.groups ?? [];
  const created: string[] = [];
  const skippedExisting: string[] = [];
  let unparsedArticles = 0;

  for (const url of urls) {
    const articleHtml = await opts.fetchArticleHtml(url);
    const text = htmlToPlainText(articleHtml);
    const eventName = extractEventNameFromArticle(text);
    if (!eventName) {
      unparsedArticles += 1;
      continue;
    }

    const events = opts.listEvents();
    const existingIdentity =
      matchExistingEvent(eventName, events) ??
      events.find((e) => e.eventId === slugifyEventId(eventName)) ??
      null;
    const existing = existingIdentity
      ? opts.loadSeed(existingIdentity.eventId)
      : null;

    if (existing?.entries.length) {
      skippedExisting.push(existing.eventId);
      continue;
    }

    const monsterIds = resolveMonsterIds(
      extractUpgradeMonsterNames(text),
      catalog
    );
    const sourceUrl = findRelatedEventUrl(newsHtml, eventName) ?? url;
    const groupId =
      matchGroupByEventName(eventName, groups)?.groupId ??
      existing?.groupId ??
      null;

    if (existing) {
      opts.saveSeed(mergeEventSeed(existing, { monsterIds, groupId }));
      created.push(existing.eventId);
      continue;
    }

    const eventId = slugifyEventId(eventName);
    opts.saveSeed(
      createEventSeed({
        eventId,
        title: eventName,
        sourceUrl,
        monsterIds,
        groupId,
      })
    );
    created.push(eventId);
  }

  return {
    created,
    skippedExisting,
    unparsedArticles,
  };
}

function resolveMonsterIds(
  names: string[],
  catalog: MonsterNameRow[]
): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const name of names) {
    const id = resolveMonsterIdByName(name, catalog);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
