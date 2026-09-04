import frameDark from "../assets/pad/frames/dark.png";
import frameFire from "../assets/pad/frames/fire.png";
import frameLight from "../assets/pad/frames/light.png";
import frameWater from "../assets/pad/frames/water.png";
import frameWood from "../assets/pad/frames/wood.png";

/** dadguide attribute id → frame asset (orb baked in top-left). */
export const ATTRIBUTE_FRAME_SRC: Record<number, string> = {
  0: frameFire,
  1: frameWater,
  2: frameWood,
  3: frameLight,
  4: frameDark,
};

/**
 * Slot → CSS rotate so the baked top-left orb lands on PAD corners:
 * 1 = top-left, 2 = bottom-right, 3 = bottom-left.
 */
export const ATTRIBUTE_FRAME_ROTATION_DEG = [0, 180, 270] as const;

/** Outer corner radius of frame assets (~14% of 100px). */
export const ATTRIBUTE_FRAME_RADIUS_PCT = 14;

export function isFramedAttributeId(id: number | null | undefined): id is number {
  return id != null && id in ATTRIBUTE_FRAME_SRC;
}

export function framedAttributeIds(
  ids: Array<number | null | undefined>
): number[] {
  const out: number[] = [];
  for (const id of ids) {
    if (!isFramedAttributeId(id)) continue;
    out.push(id);
    if (out.length >= 3) break;
  }
  return out;
}

const processedCache = new Map<string, string>();
const PROCESS_VERSION = "v2-flood-center";

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Punch only the contiguous near-black "window" connected to the center.
 * Outer black/transparent corners outside the rounded frame stay untouched
 * so the portrait cannot leak past the frame silhouette.
 */
export async function frameSrcWithClearCenter(src: string): Promise<string> {
  const cacheKey = `${PROCESS_VERSION}:${src}`;
  const cached = processedCache.get(cacheKey);
  if (cached) return cached;

  const img = await loadImage(src);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0);
  const image = ctx.getImageData(0, 0, w, h);
  const { data } = image;

  const BLACK = 28;
  const idx = (x: number, y: number) => (y * w + x) * 4;
  const isHole = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const i = idx(x, y);
    const a = data[i + 3]!;
    if (a < 8) return true; // already empty counts as hole connectivity
    return luma(data[i]!, data[i + 1]!, data[i + 2]!) < BLACK;
  };

  const startX = Math.floor(w / 2);
  const startY = Math.floor(h / 2);
  if (!isHole(startX, startY)) {
    // Fallback: force a center sample a bit inward if mid is on a highlight
    let found = false;
    for (let r = 0; r < Math.min(w, h) / 3 && !found; r++) {
      for (const [dx, dy] of [
        [0, 0],
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
      ] as const) {
        if (isHole(startX + dx, startY + dy)) {
          floodClear(data, w, h, startX + dx, startY + dy, BLACK);
          found = true;
          break;
        }
      }
    }
    if (!found) {
      processedCache.set(cacheKey, src);
      return src;
    }
  } else {
    floodClear(data, w, h, startX, startY, BLACK);
  }

  // Fully opaque remaining colored frame pixels
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! > 0 && data[i + 3]! < 255) {
      const L = luma(data[i]!, data[i + 1]!, data[i + 2]!);
      if (L >= BLACK) data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL("image/png");
  processedCache.set(cacheKey, url);
  return url;
}

function floodClear(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  sx: number,
  sy: number,
  blackLuma: number
) {
  const seen = new Uint8Array(w * h);
  const stack: number[] = [sy * w + sx];
  seen[sy * w + sx] = 1;

  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p / w) | 0;
    const i = p * 4;
    const a = data[i + 3]!;
    const L = luma(data[i]!, data[i + 1]!, data[i + 2]!);
    const hole = a < 8 || L < blackLuma;
    if (!hole) continue;
    data[i + 3] = 0;

    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (seen[np]) continue;
      seen[np] = 1;
      stack.push(np);
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load frame: ${src}`));
    img.src = src;
  });
}
