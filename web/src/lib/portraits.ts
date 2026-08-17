const CDN_ORIGIN =
  import.meta.env.VITE_PAD_CDN_ORIGIN?.replace(/\/$/, "") ?? "";

/** Full art — set VITE_PORTRAIT_CDN_BASE or VITE_PAD_CDN_ORIGIN at build time. */
export const PORTRAIT_CDN_BASE = (
  import.meta.env.VITE_PORTRAIT_CDN_BASE?.replace(/\/$/, "") ??
  (CDN_ORIGIN ? `${CDN_ORIGIN}/portraits` : "")
);

/** Small square icon (stats bar thumbnail). */
export const ICON_CDN_BASE = (
  import.meta.env.VITE_ICON_CDN_BASE?.replace(/\/$/, "") ??
  (CDN_ORIGIN ? `${CDN_ORIGIN}/icons` : "")
);

/** CDN filenames are zero-padded to this width (e.g. 1234 → 01234). */
export const PORTRAIT_ID_PAD_LENGTH = 5;

export function portraitFileId(monsterId: number): string {
  return String(monsterId).padStart(PORTRAIT_ID_PAD_LENGTH, "0");
}

export function portraitUrl(monsterId: number): string {
  if (!PORTRAIT_CDN_BASE) return "";
  return `${PORTRAIT_CDN_BASE}/${portraitFileId(monsterId)}.png`;
}

export function iconUrl(monsterId: number): string {
  if (!ICON_CDN_BASE) return "";
  return `${ICON_CDN_BASE}/${portraitFileId(monsterId)}.png`;
}
