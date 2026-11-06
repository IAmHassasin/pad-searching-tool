/**
 * CDN art / icon for a new card (browser only). The card number comes from OCR, so the CDN
 * files are used only when they can be tied to the screenshot: the CDN icon must match the
 * thumbnail, or — when the CDN has no icon yet, as for brand-new cards — the number must be
 * one the catalog does not know (newer than the catalog) and read with five digits.
 */
import { cardDescriptor, grayThumbnail, type Box, type RgbaImage } from "../team-build/screenshot/descriptor.ts";
import { iconUrl, portraitUrl } from "../portraits";
import { alignedThumbScore } from "./identify.ts";

/** Correlation between the CDN icon and the screenshot thumbnail from which the CDN art is trusted. */
export const CDN_ICON_MATCH_MIN_SCORE = 0.8;

/** The image as a Blob when the CDN has it, null on any failure (403 for cards without an icon). */
export async function fetchCdnBlob(url: string): Promise<Blob | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.size > 0 && blob.type.startsWith("image/") ? blob : null;
  } catch {
    return null;
  }
}

export type CdnArt = {
  portrait: Blob | null;
  icon: Blob | null;
  /** Why the CDN files were (not) used; shown in the review UI. */
  note: string | null;
  /** Correlation of the CDN icon with the thumbnail, when an icon was fetched. */
  iconScore: number | null;
};

async function decodeBlob(blob: Blob): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
    ctx.drawImage(bitmap, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width, height, data };
  } finally {
    bitmap.close();
  }
}

export type CdnArtRequest = {
  number: number | null;
  /** True when the catalog's icon index knows this number (then its icon already failed to match). */
  numberIndexed: boolean;
  image: RgbaImage;
  thumb: Box;
};

/** Portrait and icon of the card from the CDN, each null when missing or not trusted. */
export async function fetchCdnArt(req: CdnArtRequest): Promise<CdnArt> {
  const { number } = req;
  if (number == null || !Number.isInteger(number) || number <= 0) {
    return { portrait: null, icon: null, note: "Card number not read; art cut from the screenshot.", iconScore: null };
  }
  if (req.numberIndexed) {
    return {
      portrait: null,
      icon: null,
      note: `No.${number} is a catalog card whose icon does not match this screenshot; art cut from the screenshot.`,
      iconScore: null,
    };
  }
  const [portrait, icon] = await Promise.all([fetchCdnBlob(portraitUrl(number)), fetchCdnBlob(iconUrl(number))]);
  if (icon) {
    const iconImage = await decodeBlob(icon);
    const target = cardDescriptor(grayThumbnail(iconImage, { x: 0, y: 0, w: iconImage.width, h: iconImage.height }));
    const { score } = alignedThumbScore(req.image, req.thumb, target);
    if (score >= CDN_ICON_MATCH_MIN_SCORE) {
      return { portrait, icon, note: null, iconScore: score };
    }
    return {
      portrait: null,
      icon: null,
      note: `CDN icon for No.${number} does not match the thumbnail (score ${score.toFixed(2)}); art cut from the screenshot.`,
      iconScore: score,
    };
  }
  if (portrait && number >= 10000) {
    return {
      portrait,
      icon: null,
      note: `CDN portrait for No.${number} used without an icon to verify it against; check the art.`,
      iconScore: null,
    };
  }
  return { portrait: null, icon: null, note: portrait ? "CDN art not trusted for a short card number; art cut from the screenshot." : null, iconScore: null };
}
