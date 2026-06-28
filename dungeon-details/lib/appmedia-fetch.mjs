const APP_MEDIA_ORIGIN = "https://appmedia.jp";
const USER_AGENT = "pad-searching-tool/dungeon-details";

/** @param {string} urlOrId */
export function parseAppMediaPostId(urlOrId) {
  const raw = String(urlOrId).trim();
  const fromUrl = raw.match(/\/pazudora\/(\d+)\/?(?:[#?].*)?$/i);
  if (fromUrl) return Number(fromUrl[1]);
  if (/^\d+$/.test(raw)) return Number(raw);
  throw new Error(`Cannot parse AppMedia post id from: ${raw}`);
}

/** @param {string} href */
export function absolutizeAppMediaUrl(href) {
  if (!href) return href;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return `${APP_MEDIA_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
}

/**
 * @param {number} postId
 * @returns {Promise<{ postId: number, titleJa: string, sourceUrl: string, modified: string, html: string }>}
 */
export async function fetchAppMediaPost(postId) {
  const res = await fetch(`${APP_MEDIA_ORIGIN}/wp-json/wp/v2/posts/${postId}`, {
    headers: { "user-agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`AppMedia WP API ${res.status} for post ${postId}`);
  }
  const json = await res.json();
  const html = json.content?.rendered;
  if (!html) {
    throw new Error(`AppMedia post ${postId} has no content.rendered`);
  }
  return {
    postId,
    titleJa: json.title?.rendered ?? "",
    sourceUrl: json.link ?? `${APP_MEDIA_ORIGIN}/pazudora/${postId}`,
    modified: json.modified ?? "",
    html,
  };
}
