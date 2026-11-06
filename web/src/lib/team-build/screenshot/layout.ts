/**
 * Where the six card icons sit on a PAD "Edit Team" screenshot.
 *
 * The game lays the panel out relative to the screen width, so every horizontal position and
 * size is a fraction of the image width. The vertical position depends on the device aspect
 * ratio (letterboxing), so the card row is searched: the five big cards have a thick frame, and
 * the row whose top and bottom frame edges are strongest across all five boxes wins.
 *
 * Two geometries are kept apart: the visible *frame* (used to find the row by its edges) and
 * the *icon* art inside it (what the CDN icon shows, used for matching). They differ by a few
 * pixels, and matching is sensitive to that.
 */
import type { Box, RgbaImage } from "./descriptor.ts";

export type GrayImage = { width: number; height: number; data: Uint8Array };

export function toGrayImage(img: RgbaImage): GrayImage {
  const n = img.width * img.height;
  const data = new Uint8Array(n);
  const src = img.data;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    data[i] = Math.round(0.299 * src[p] + 0.587 * src[p + 1] + 0.114 * src[p + 2]);
  }
  return { width: img.width, height: img.height, data };
}

export type LayoutProfile = {
  id: string;
  /** Visible frames of the five big cards: size and left edges, as width fractions. */
  frame: { size: number; x: readonly number[] };
  /**
   * Icon art inside each frame: size and left edges as width fractions, plus the top offset
   * from the frame row top (width fraction, negative = above).
   */
  icon: { size: number; x: readonly number[]; dy: number };
  /** Helper thumbnail: left edge, size and top offset from the frame row top (width fractions). */
  helper: { x: number; size: number; dy: number };
  /** Assist inlay relative to its icon box, in icon sizes. */
  assist: { dx: number; dy: number; size: number };
};

/** Slot order used everywhere: leader, sub 1–4, helper (same as TeamBuildConfig.members). */
export const HELPER_SLOT = 5;
export const SLOT_COUNT = 6;

/** EN client, Edit Team screen; measured on a 1008 px wide screenshot. */
export const EDIT_TEAM_LAYOUT: LayoutProfile = {
  id: "edit-team",
  frame: { size: 0.1607, x: [0.0556, 0.2867, 0.4534, 0.622, 0.7907] },
  icon: { size: 0.1488, x: [0.0605, 0.2917, 0.4603, 0.63, 0.7986], dy: -0.006 },
  helper: { x: 0.8512, size: 0.1012, dy: -0.1667 },
  assist: { dx: 0.3, dy: 0.733, size: 0.487 },
};

export type SlotBoxes = {
  /** Six icon boxes in slot order. */
  cards: Box[];
  /** Assist inlay per slot; the helper thumbnail shows none. */
  assists: (Box | null)[];
};

export function assistBoxFor(icon: Box, profile: LayoutProfile): Box {
  const s = Math.round(icon.w * profile.assist.size);
  return {
    x: Math.round(icon.x + icon.w * profile.assist.dx),
    y: Math.round(icon.y + icon.h * profile.assist.dy),
    w: s,
    h: s,
  };
}

/** The five visible frames for a frame row top (row detection only). */
export function frameBoxesForRow(
  profile: LayoutProfile,
  width: number,
  rowY: number
): Box[] {
  const size = Math.round(profile.frame.size * width);
  return profile.frame.x.map((fx) => ({
    x: Math.round(fx * width),
    y: rowY,
    w: size,
    h: size,
  }));
}

/** Icon boxes (and assist inlays) for a frame row top. */
export function boxesForRow(
  profile: LayoutProfile,
  width: number,
  rowY: number
): SlotBoxes {
  const size = Math.round(profile.icon.size * width);
  const iconY = Math.round(rowY + profile.icon.dy * width);
  const cards: Box[] = profile.icon.x.map((fx) => ({
    x: Math.round(fx * width),
    y: iconY,
    w: size,
    h: size,
  }));
  const helperSize = Math.round(profile.helper.size * width);
  cards.push({
    x: Math.round(profile.helper.x * width),
    y: Math.round(rowY + profile.helper.dy * width),
    w: helperSize,
    h: helperSize,
  });
  const assists = cards.map((c, i) =>
    i === HELPER_SLOT ? null : assistBoxFor(c, profile)
  );
  return { cards, assists };
}

/** Pixels either side of an edge line that are compared. */
const EDGE_REACH = 2;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Mean |Δ luminance| across a horizontal line at `y`, x in [x0, x1). */
export function horizontalEdge(
  g: GrayImage,
  x0: number,
  x1: number,
  y: number
): number {
  const ya = clamp(y - EDGE_REACH, 0, g.height - 1);
  const yb = clamp(y + EDGE_REACH, 0, g.height - 1);
  const xa = clamp(x0, 0, g.width);
  const xb = clamp(x1, 0, g.width);
  if (xb <= xa || ya === yb) return 0;
  let sum = 0;
  const rowA = ya * g.width;
  const rowB = yb * g.width;
  for (let x = xa; x < xb; x++) sum += Math.abs(g.data[rowB + x] - g.data[rowA + x]);
  return sum / (xb - xa);
}

/** Mean |Δ luminance| across a vertical line at `x`, y in [y0, y1). */
export function verticalEdge(
  g: GrayImage,
  y0: number,
  y1: number,
  x: number
): number {
  const xa = clamp(x - EDGE_REACH, 0, g.width - 1);
  const xb = clamp(x + EDGE_REACH, 0, g.width - 1);
  const ya = clamp(y0, 0, g.height);
  const yb = clamp(y1, 0, g.height);
  if (yb <= ya || xa === xb) return 0;
  let sum = 0;
  for (let y = ya; y < yb; y++) {
    const row = y * g.width;
    sum += Math.abs(g.data[row + xb] - g.data[row + xa]);
  }
  return sum / (yb - ya);
}

/** Average edge strength along the four sides of a box. */
export function boxEdgeScore(g: GrayImage, box: Box): number {
  return (
    (horizontalEdge(g, box.x, box.x + box.w, box.y) +
      horizontalEdge(g, box.x, box.x + box.w, box.y + box.h) +
      verticalEdge(g, box.y, box.y + box.h, box.x) +
      verticalEdge(g, box.y, box.y + box.h, box.x + box.w)) /
    4
  );
}

/** For every possible row top, the mean top+bottom frame edge strength over the five big cards. */
export function rowEdgeProfile(g: GrayImage, profile: LayoutProfile): Float32Array {
  const size = Math.round(profile.frame.size * g.width);
  const out = new Float32Array(Math.max(0, g.height - size));
  const ranges = profile.frame.x.map((fx) => {
    const x = Math.round(fx * g.width);
    return [x, x + size] as const;
  });
  for (let y = 0; y < out.length; y++) {
    let s = 0;
    for (const [xa, xb] of ranges) {
      s += horizontalEdge(g, xa, xb, y) + horizontalEdge(g, xa, xb, y + size);
    }
    out[y] = s / (2 * ranges.length);
  }
  return out;
}

/** Nudge a box by up to `radius` px in each direction to the strongest edges. */
export function refineBox(g: GrayImage, box: Box, radius = 8): Box {
  let best = box;
  let bestScore = boxEdgeScore(g, box);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const candidate = { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h };
      const score = boxEdgeScore(g, candidate);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }
  return best;
}

/** Nudge radius used while ranking candidate rows. */
const ROW_REFINE_RADIUS = 8;

/**
 * Frame row tops worth trying, best first. Local maxima of the edge profile (at least half a
 * card apart) are collected into a pool, each one's five frames are nudged onto the nearest
 * edges, and the pool is re-ranked by the total edge strength of those refined frames: UI
 * banners also produce strong straight edges, but only the real card row has five complete
 * frames. The matcher then scores the survivors against the icon index and keeps the best.
 */
export function candidateRows(
  g: GrayImage,
  profile: LayoutProfile,
  maxCandidates = 5,
  poolSize = 15
): number[] {
  const prof = rowEdgeProfile(g, profile);
  const size = Math.round(profile.frame.size * g.width);
  const minGap = Math.max(1, Math.floor(size / 2));
  const peaks: { y: number; v: number }[] = [];
  for (let y = 0; y < prof.length; y++) {
    const v = prof[y];
    if (v <= 0) continue;
    const prev = y === 0 ? -1 : prof[y - 1];
    const next = y === prof.length - 1 ? -1 : prof[y + 1];
    if (prev <= v && next < v) peaks.push({ y, v });
  }
  peaks.sort((a, b) => b.v - a.v);
  const pool: number[] = [];
  for (const p of peaks) {
    if (pool.every((c) => Math.abs(c - p.y) >= minGap)) pool.push(p.y);
    if (pool.length >= poolSize) break;
  }
  const ranked = pool.map((rowY) => {
    const total = frameBoxesForRow(profile, g.width, rowY).reduce(
      (sum, box) => sum + boxEdgeScore(g, refineBox(g, box, ROW_REFINE_RADIUS)),
      0
    );
    return { rowY, total };
  });
  ranked.sort((a, b) => b.total - a.total);
  return ranked.slice(0, maxCandidates).map((r) => r.rowY);
}
