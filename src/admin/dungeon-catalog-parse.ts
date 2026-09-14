const INDEX_POST_IDS = new Set([83349, 79773035, 467565]);

const TARGET_SECTIONS = ["ゲリラダンジョン", "ステージダンジョン"] as const;

export function collectSidebarDungeonPostIds(html: string): number[] {
  const stripped = html.replace(/<!--[\s\S]*?-->/g, "");
  const seen = new Set<number>();
  const ids: number[] = [];

  for (const title of TARGET_SECTIONS) {
    const block = extractSection(stripped, title);
    if (!block) continue;
    for (const { id, label } of collectLinks(block)) {
      if (INDEX_POST_IDS.has(id)) continue;
      if (label.includes("一覧")) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}

export function parseDungeonUrlListIds(text: string): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/\/pazudora\/(\d+)/);
    if (!match) continue;
    const id = Number(match[1]);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function filterNewDungeonPostIds(
  ids: number[],
  opts: {
    cutoff: number;
    existingIds: Iterable<number>;
    previouslyImportedIds?: Iterable<number>;
  }
): number[] {
  const existing = new Set(opts.existingIds);
  const previous = new Set(opts.previouslyImportedIds ?? []);
  return ids.filter((id) => {
    if (existing.has(id)) return false;
    return id > opts.cutoff || previous.has(id);
  });
}

function extractSection(html: string, title: string): string | null {
  const marker = `<span class="leftmenu_title">${title}</span>`;
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const ulStart = html.indexOf("<ul", start);
  if (ulStart < 0) return null;
  const afterOpen = html.indexOf(">", ulStart);
  if (afterOpen < 0) return null;
  const ulEnd = html.indexOf("</ul>", afterOpen);
  if (ulEnd < 0) return null;
  return html.slice(afterOpen + 1, ulEnd);
}

function collectLinks(
  html: string
): Array<{ id: number; label: string }> {
  const out: Array<{ id: number; label: string }> = [];
  const re =
    /<a\s[^>]*href="[^"]*\/pazudora\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const id = Number(match[1]);
    const label = match[2].replace(/<[^>]+>/g, "").trim();
    if (Number.isFinite(id) && id > 0) out.push({ id, label });
  }
  return out;
}
