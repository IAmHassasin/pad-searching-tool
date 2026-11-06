/** Browser-only glue: decode an image file, cut thumbnails, load the icon index once. */
import type { Box, RgbaImage } from "./descriptor.ts";
import { parseIconIndex, type IconIndex } from "./icon-index.ts";

export const ICON_INDEX_URL = `${import.meta.env.BASE_URL}team-build/icon-index.bin`;

/** Screenshots wider than this are downscaled before matching (layout is width-relative). */
const MAX_DECODE_WIDTH = 2000;

export async function decodeImageFile(
  file: Blob,
  maxWidth = MAX_DECODE_WIDTH
): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    return { width, height, data };
  } finally {
    bitmap.close();
  }
}

/** PNG data URL of `box`, scaled to `outSize` px, for the confirmation UI. */
export function cropDataUrl(img: RgbaImage, box: Box, outSize = 96): string {
  const x0 = Math.max(0, Math.min(img.width - 1, Math.round(box.x)));
  const y0 = Math.max(0, Math.min(img.height - 1, Math.round(box.y)));
  const x1 = Math.max(x0 + 1, Math.min(img.width, Math.round(box.x + box.w)));
  const y1 = Math.max(y0 + 1, Math.min(img.height, Math.round(box.y + box.h)));
  const w = x1 - x0;
  const h = y1 - y0;
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const src = ((y0 + y) * img.width + x0) * 4;
    pixels.set(img.data.subarray(src, src + w * 4), y * w * 4);
  }
  const crop = document.createElement("canvas");
  crop.width = w;
  crop.height = h;
  crop.getContext("2d")?.putImageData(new ImageData(pixels, w, h), 0, 0);
  const out = document.createElement("canvas");
  out.width = outSize;
  out.height = outSize;
  out.getContext("2d")?.drawImage(crop, 0, 0, outSize, outSize);
  return out.toDataURL("image/png");
}

let indexPromise: Promise<IconIndex> | null = null;

/** Fetches and parses the icon index once per page; a failed load can be retried. */
export function loadIconIndex(url = ICON_INDEX_URL): Promise<IconIndex> {
  if (!indexPromise) {
    indexPromise = fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Icon index is not available (HTTP ${res.status}).`);
        }
        return parseIconIndex(await res.arrayBuffer());
      })
      .catch((err: unknown) => {
        indexPromise = null;
        throw err;
      });
  }
  return indexPromise;
}
