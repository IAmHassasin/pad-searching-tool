/**
 * Pixel descriptor shared by the icon-index build script (node) and the browser matcher.
 * Both sides must produce identical bytes for the same pixels, so everything here is plain
 * arithmetic on RGBA buffers — no canvas, no image library.
 */

/** Thumbnail edge length in pixels. */
export const DESCRIPTOR_SIZE = 16;
/**
 * Rows of the thumbnail compared for a card. The bottom of an in-game card is covered by the
 * assist inlay and the +297 badges, so only the top 10 rows (62.5 %) take part in matching.
 */
export const CARD_ROWS = 10;
export const CARD_DESCRIPTOR_LENGTH = DESCRIPTOR_SIZE * CARD_ROWS;

/** Indices into a card descriptor (row-major, `DESCRIPTOR_SIZE` per row). */
export type CellMask = Uint16Array;

function cellMask(keep: (x: number, y: number) => boolean): CellMask {
  const cells: number[] = [];
  for (let y = 0; y < CARD_ROWS; y++) {
    for (let x = 0; x < DESCRIPTOR_SIZE; x++) if (keep(x, y)) cells.push(y * DESCRIPTOR_SIZE + x);
  }
  return Uint16Array.from(cells);
}

/** Every cell of a card descriptor. */
export const ALL_CELLS: CellMask = cellMask(() => true);

/**
 * Cells compared for the five big team cards. The game draws the attribute orb over the top-left
 * corner and up to two large awakening/star badges over the top-right area; a card wearing those
 * badges scores ~0.6 against its own icon when they take part, and ~0.95 without them.
 */
export const TEAM_CARD_CELLS: CellMask = cellMask(
  (x, y) => !(y < 4 && x < 4) && !(y < 6 && x >= 6)
);

export type RgbaImage = {
  width: number;
  height: number;
  /** Row-major RGBA, 4 bytes per pixel (canvas ImageData or a decoded PNG buffer). */
  data: Uint8Array | Uint8ClampedArray;
};

export type Box = { x: number; y: number; w: number; h: number };

function clampInt(value: number, min: number, max: number): number {
  const n = Math.round(value);
  return n < min ? min : n > max ? max : n;
}

export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Area-averaged grey thumbnail (`size` × `size`) of `box`. The box is clamped to the image, so a
 * box that sticks out of the picture still yields a thumbnail of the visible part.
 */
export function grayThumbnail(
  img: RgbaImage,
  box: Box,
  size = DESCRIPTOR_SIZE
): Uint8Array {
  const out = new Uint8Array(size * size);
  if (img.width <= 0 || img.height <= 0) return out;
  const x0 = clampInt(box.x, 0, img.width - 1);
  const y0 = clampInt(box.y, 0, img.height - 1);
  const x1 = clampInt(box.x + box.w, x0 + 1, img.width);
  const y1 = clampInt(box.y + box.h, y0 + 1, img.height);
  const w = x1 - x0;
  const h = y1 - y0;
  const { data, width } = img;
  for (let ty = 0; ty < size; ty++) {
    const ya = y0 + Math.floor((ty * h) / size);
    const yb = Math.max(ya + 1, y0 + Math.floor(((ty + 1) * h) / size));
    for (let tx = 0; tx < size; tx++) {
      const xa = x0 + Math.floor((tx * w) / size);
      const xb = Math.max(xa + 1, x0 + Math.floor(((tx + 1) * w) / size));
      let sum = 0;
      let n = 0;
      for (let y = ya; y < yb; y++) {
        let i = (y * width + xa) * 4;
        for (let x = xa; x < xb; x++, i += 4) {
          sum += luminance(data[i], data[i + 1], data[i + 2]);
          n++;
        }
      }
      out[ty * size + tx] = Math.round(sum / n);
    }
  }
  return out;
}

/** The part of a thumbnail used for card matching (top `CARD_ROWS` rows). */
export function cardDescriptor(thumb: Uint8Array): Uint8Array {
  return thumb.subarray(0, CARD_DESCRIPTOR_LENGTH);
}

/** Pearson correlation of two equally long vectors; 0 when either one is constant. */
export function correlation(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  length = Math.min(a.length, b.length)
): number {
  if (length === 0) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < length; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= length;
  mb /= length;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < length; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  if (da === 0 || db === 0) return 0;
  return num / Math.sqrt(da * db);
}

/** Pearson correlation over the `cells` of two descriptors only; 0 when either is constant. */
export function maskedCorrelation(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  cells: CellMask
): number {
  const n = cells.length;
  if (n === 0) return 0;
  let ma = 0;
  let mb = 0;
  for (let k = 0; k < n; k++) {
    ma += a[cells[k]];
    mb += b[cells[k]];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let k = 0; k < n; k++) {
    const x = a[cells[k]] - ma;
    const y = b[cells[k]] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  if (da === 0 || db === 0) return 0;
  return num / Math.sqrt(da * db);
}
