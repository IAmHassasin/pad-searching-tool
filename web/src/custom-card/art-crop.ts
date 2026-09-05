import {
  CUSTOM_CARD_ART_ASPECT,
  CUSTOM_CARD_ART_OUT_HEIGHT,
  CUSTOM_CARD_ART_OUT_WIDTH,
  type ArtCropRect,
} from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Crop width in normalized image-X units for a given height fraction. */
export function artCropWidthNorm(
  heightNorm: number,
  nw: number,
  nh: number,
  aspect = CUSTOM_CARD_ART_ASPECT
): number {
  if (nw <= 0) return 0;
  return heightNorm * (nh / nw) * aspect;
}

/**
 * Default crop: fit the whole image in the 2:3 frame, then zoom out so the
 * subject starts smaller on the card (portrait needs more pad than landscape).
 */
export function defaultArtCrop(
  nw: number,
  nh: number,
  aspect = CUSTOM_CARD_ART_ASPECT
): ArtCropRect {
  const imageAspect = nw / Math.max(nh, 1);
  let height: number;
  if (imageAspect > aspect) {
    // Wide source — fill frame width (full-bleed on card).
    height = 1 / Math.max(artCropWidthNorm(1, nw, nh, aspect), 1e-9);
  } else {
    // Tall / square — zoom out so full-width card display isn't huge.
    height = 1.45;
  }
  const widthNorm = artCropWidthNorm(height, nw, nh, aspect);
  return clampArtCrop(
    {
      x: (1 - widthNorm) / 2,
      y: (1 - height) / 2,
      height,
    },
    nw,
    nh,
    aspect
  );
}

/**
 * Soft-clamp crop. Frame may hang past the image (transparent padding).
 * Keeps a small overlap with the image so the result isn't fully empty,
 * and caps zoom so the frame isn't tiny or huge relative to the source.
 */
export function clampArtCrop(
  crop: ArtCropRect,
  nw: number,
  nh: number,
  aspect = CUSTOM_CARD_ART_ASPECT
): ArtCropRect {
  const minH = 0.12;
  // Allow larger-than-image frames (transparent margins around small art).
  const maxH = 3;
  let height = clamp(crop.height, minH, maxH);
  let widthNorm = artCropWidthNorm(height, nw, nh, aspect);

  // At least ~8% of the frame must still overlap the image.
  const minOverlap = 0.08;
  const maxX = 1 - widthNorm * minOverlap;
  const minX = -widthNorm * (1 - minOverlap);
  const maxY = 1 - height * minOverlap;
  const minY = -height * (1 - minOverlap);

  return {
    x: clamp(crop.x, minX, maxX),
    y: clamp(crop.y, minY, maxY),
    height,
  };
}

/**
 * Rasterize crop to a transparent PNG. Areas of the 2:3 frame outside the
 * source image stay transparent.
 */
export async function rasterizeArtCrop(
  img: HTMLImageElement,
  crop: ArtCropRect,
  aspect = CUSTOM_CARD_ART_ASPECT
): Promise<{ crop: ArtCropRect; blob: Blob }> {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const c = clampArtCrop(crop, nw, nh, aspect);
  const widthNorm = artCropWidthNorm(c.height, nw, nh, aspect);

  const cropX = c.x * nw;
  const cropY = c.y * nh;
  const cropW = Math.max(1, widthNorm * nw);
  const cropH = Math.max(1, c.height * nh);

  const canvas = document.createElement("canvas");
  canvas.width = CUSTOM_CARD_ART_OUT_WIDTH;
  canvas.height = CUSTOM_CARD_ART_OUT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const srcLeft = Math.max(0, cropX);
  const srcTop = Math.max(0, cropY);
  const srcRight = Math.min(nw, cropX + cropW);
  const srcBottom = Math.min(nh, cropY + cropH);
  const srcW = srcRight - srcLeft;
  const srcH = srcBottom - srcTop;

  if (srcW > 0.5 && srcH > 0.5) {
    const destLeft = ((srcLeft - cropX) / cropW) * CUSTOM_CARD_ART_OUT_WIDTH;
    const destTop = ((srcTop - cropY) / cropH) * CUSTOM_CARD_ART_OUT_HEIGHT;
    const destW = (srcW / cropW) * CUSTOM_CARD_ART_OUT_WIDTH;
    const destH = (srcH / cropH) * CUSTOM_CARD_ART_OUT_HEIGHT;
    ctx.drawImage(
      img,
      srcLeft,
      srcTop,
      srcW,
      srcH,
      destLeft,
      destTop,
      destW,
      destH
    );
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("Failed to encode art crop");
  return { crop: c, blob };
}
