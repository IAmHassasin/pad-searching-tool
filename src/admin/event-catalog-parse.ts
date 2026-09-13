export type EventIdentity = {
  eventId: string;
  title: string;
};

const STOP_WORDS = new Set(["returns", "return", "the", "a", "an"]);
const GROUP_STOP_WORDS = new Set([
  ...STOP_WORDS,
  "collab",
  "collaboration",
  "event",
]);

export function listEvolutionArticleUrls(html: string): string[] {
  const re =
    /https:\/\/www\.puzzleanddragons\.us\/single-post\/new-evolutions-upgrades[^"'\\\s]*/gi;
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const match of html.matchAll(re)) {
    const url = match[0].replace(/[),.;]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export function extractEventNameFromArticle(text: string): string | null {
  const match = text.match(
    /Select\s+(.+?)\s+(?:monsters|characters)\s+have received upgrades as well!/i
  );
  const name = match?.[1]?.trim();
  return name || null;
}

export function extractUpgradeMonsterNames(text: string): string[] {
  const match = text.match(
    /(?:^|[.!?]\s+)([^.!?]*?)\s+have received Assist Evolutions!?/i
  );
  const clause = match?.[1]?.trim();
  if (!clause) return [];
  return clause
    .split(/\s+and\s+/i)
    .map((part) => part.replace(/^,\s*/, "").trim())
    .filter(Boolean);
}

export function slugifyEventId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function listNewsPostUrls(html: string): string[] {
  const re =
    /https:\/\/www\.puzzleanddragons\.us\/single-post\/[a-z0-9-]+/gi;
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const match of html.matchAll(re)) {
    const url = match[0].replace(/[),.;]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/** Sibling news post for the event (not upgrades, not Godfest). */
export function findRelatedEventUrl(
  html: string,
  eventName: string
): string | null {
  const slug = slugifyEventId(eventName);
  if (!slug) return null;
  const candidates = listNewsPostUrls(html).filter((url) => {
    const part = url.split("/single-post/")[1] ?? "";
    if (part.includes("new-evolutions-upgrades")) return false;
    if (part.includes("godfest")) return false;
    return part.includes(slug);
  });
  const preferred = candidates.find((url) => {
    const part = url.split("/single-post/")[1] ?? "";
    return part.includes(`${slug}-event`);
  });
  return preferred ?? candidates[0] ?? null;
}

export function matchExistingEvent(
  eventName: string,
  events: EventIdentity[]
): EventIdentity | null {
  const slug = slugifyEventId(eventName);
  const byId = events.find((e) => e.eventId === slug);
  if (byId) return byId;

  const incoming = tokens(eventName);
  if (!incoming.length) return null;

  let best: EventIdentity | null = null;
  let bestScore = 0;
  for (const event of events) {
    const haystack = new Set([
      ...tokens(event.eventId),
      ...tokens(event.title),
    ]);
    if (![...incoming].every((t) => haystack.has(t))) continue;
    if (incoming.length > bestScore) {
      best = event;
      bestScore = incoming.length;
    }
  }
  return best;
}

export type CollabGroupIdentity = {
  groupId: number;
  groupName: string | null;
};

/** Match a PAD US event name to a dadguide collab/series group. */
export function matchGroupByEventName(
  eventName: string,
  groups: CollabGroupIdentity[]
): CollabGroupIdentity | null {
  const incoming = new Set(tokens(eventName, GROUP_STOP_WORDS));
  if (!incoming.size) return null;

  const minScore = Math.min(2, incoming.size);
  let best: CollabGroupIdentity | null = null;
  let bestScore = 0;
  for (const group of groups) {
    const groupTokens = tokens(group.groupName ?? "", GROUP_STOP_WORDS);
    if (groupTokens.length < minScore) continue;
    if (!groupTokens.every((t) => incoming.has(t))) continue;
    if (groupTokens.length > bestScore) {
      best = group;
      bestScore = groupTokens.length;
    }
  }
  return best;
}

function tokens(
  value: string,
  stopWords: Set<string> = STOP_WORDS
): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !stopWords.has(t) && !/^\d{4}$/.test(t));
}
