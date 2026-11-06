/**
 * Awakening icons on the detail screen → awoken_skill_id, by colour template matching
 * against the awakening sprite tiles (31×32). Templates come from `sprite.webp` in the
 * browser and from the `awoken.png` strip in node; both produce the same descriptors.
 */
import { correlation, type Box, type RgbaImage } from "../team-build/screenshot/descriptor.ts";
import { cropImage, isVivid, meanColor, rgbThumbnail } from "./pixels.ts";

export const AWAKENING_TILE_W = 31;
export const AWAKENING_TILE_H = 32;
/** Colour descriptor grid (per axis); 3 bytes per cell. */
export const AWAKENING_DESC_SIZE = 8;
export const AWAKENING_DESC_LENGTH = AWAKENING_DESC_SIZE * AWAKENING_DESC_SIZE * 3;

/** Score at which an icon is considered recognised; below it the slot is offered for review. */
export const AWAKENING_MIN_SCORE = 0.8;
/** Matches below this score are left out of the generated card (and marked in the review UI). */
export const AWAKENING_DRAFT_MIN_SCORE = 0.7;

export type AwakeningTemplates = { ids: number[]; descriptors: Uint8Array[] };

export type SheetGeometry = {
  tileWidth: number;
  tileHeight: number;
  gapX: number;
  gapY: number;
  columns: number;
  rows: number;
  lastRowIcons: number;
  regionX: number;
  regionY: number;
  idBase: number;
};

export function tileDescriptor(tile: RgbaImage, box?: Box): Uint8Array {
  return rgbThumbnail(tile, box ?? { x: 0, y: 0, w: tile.width, h: tile.height }, AWAKENING_DESC_SIZE);
}

/** Templates from the vertical strip (left column, `tileHeight` rows per id, row N = id N). */
export function templatesFromStrip(strip: RgbaImage, maxId?: number): AwakeningTemplates {
  const count = Math.floor(strip.height / AWAKENING_TILE_H);
  const ids: number[] = [];
  const descriptors: Uint8Array[] = [];
  for (let id = 0; id < count; id++) {
    if (maxId != null && id > maxId) break;
    ids.push(id);
    descriptors.push(
      tileDescriptor(strip, { x: 0, y: id * AWAKENING_TILE_H, w: AWAKENING_TILE_W, h: AWAKENING_TILE_H })
    );
  }
  return { ids, descriptors };
}

/** Templates from the sprite sheet described by the awakening manifest. */
export function templatesFromSheet(sheet: RgbaImage, m: SheetGeometry): AwakeningTemplates {
  const ids: number[] = [];
  const descriptors: Uint8Array[] = [];
  const last = (m.rows - 1) * m.columns + m.lastRowIcons - 1;
  for (let index = 0; index <= last; index++) {
    const col = index % m.columns;
    const row = Math.floor(index / m.columns);
    ids.push(m.idBase + index);
    descriptors.push(
      tileDescriptor(sheet, {
        x: m.regionX + col * (m.tileWidth + m.gapX),
        y: m.regionY + row * (m.tileHeight + m.gapY),
        w: m.tileWidth,
        h: m.tileHeight,
      })
    );
  }
  return { ids, descriptors };
}

export type AwakeningMatch = { id: number; score: number; runnerUp: number; box: Box };

/** Share of vivid pixels; an empty awakening slot shows only the dark background. */
export function slotIsEmpty(img: RgbaImage, box: Box): boolean {
  return meanColor(img, box, (p) => isVivid(p, 50, 100)).share < 0.08;
}

/**
 * Best template for the icon in `box`, searching small offsets and scales so the fixed
 * layout box does not have to be pixel-exact.
 */
export function matchAwakeningIcon(
  img: RgbaImage,
  box: Box,
  templates: AwakeningTemplates,
  search = { step: 2, range: 4, scales: [0.9, 1, 1.1] }
): AwakeningMatch {
  let best: AwakeningMatch = { id: -1, score: -1, runnerUp: -1, box };
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  for (const scale of search.scales) {
    const w = box.w * scale;
    const h = box.h * scale;
    for (let dy = -search.range; dy <= search.range; dy += search.step) {
      for (let dx = -search.range; dx <= search.range; dx += search.step) {
        const candidate: Box = { x: cx - w / 2 + dx, y: cy - h / 2 + dy, w, h };
        const desc = tileDescriptor(cropImage(img, candidate));
        let top = -1;
        let topId = -1;
        let second = -1;
        for (let i = 0; i < templates.ids.length; i++) {
          const s = correlation(desc, templates.descriptors[i], AWAKENING_DESC_LENGTH);
          if (s > top) {
            second = top;
            top = s;
            topId = templates.ids[i];
          } else if (s > second) {
            second = s;
          }
        }
        if (top > best.score) best = { id: topId, score: top, runnerUp: second, box: candidate };
      }
    }
  }
  return best;
}
