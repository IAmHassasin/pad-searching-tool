/**
 * Browser loaders for the sprite-based templates: awakening tiles and the orb / lock / type
 * tiles used for inline icons, all read once from the awakening sprite sheet.
 */
import {
  awakeningSpriteImageUrl,
  awakeningSpriteManifest,
  MONSTER_TYPE_SPRITE_COL,
  MONSTER_TYPE_SPRITE_ROW,
} from "../awakening-sprite";
import { ORB_SPRITES } from "../orb-sprite";
import type { RgbaImage } from "../team-build/screenshot/descriptor.ts";
import { templatesFromSheet, tileDescriptor, type AwakeningTemplates } from "./awakening-match.ts";
import type { InlineIconTemplates } from "./inline-icons.ts";
import { opaqueBounds } from "./pixels.ts";

let sheetPromise: Promise<RgbaImage> | null = null;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the awakening sprite sheet."));
    img.src = url;
  });
}

/** The sprite sheet as raw pixels (decoded once per page). */
export function loadSpriteSheet(): Promise<RgbaImage> {
  if (!sheetPromise) {
    sheetPromise = loadImage(awakeningSpriteImageUrl)
      .then((img) => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return { width, height, data };
      })
      .catch((error: unknown) => {
        sheetPromise = null;
        throw error;
      });
  }
  return sheetPromise;
}

export async function loadAwakeningTemplates(): Promise<AwakeningTemplates> {
  const sheet = await loadSpriteSheet();
  return templatesFromSheet(sheet, awakeningSpriteManifest);
}

/**
 * Orb and lock tiles (tokens like "[Fire]", cropped to their opaque pixels so they align with
 * the tight bounding box of an icon found in text), monster type tiles ("[type:ID]") and every
 * awakening tile ("[awk:ID]").
 */
export async function loadInlineIconTemplates(): Promise<InlineIconTemplates> {
  const sheet = await loadSpriteSheet();
  const m = awakeningSpriteManifest;
  const orbs = ORB_SPRITES.map((def) => ({
    token: `[${def.label}]`,
    descriptor: tileDescriptor(sheet, opaqueBounds(sheet, { x: def.x, y: def.y, w: def.width, h: def.height })),
  }));
  const types = Object.entries(MONSTER_TYPE_SPRITE_ROW).map(([typeId, row]) => ({
    token: `[type:${typeId}]`,
    descriptor: tileDescriptor(
      sheet,
      opaqueBounds(sheet, {
        x: m.regionX + MONSTER_TYPE_SPRITE_COL * (m.tileWidth + m.gapX),
        y: m.regionY + row * (m.tileHeight + m.gapY),
        w: m.tileWidth,
        h: m.tileHeight,
      })
    ),
  }));
  const awakenings = templatesFromSheet(sheet, m);
  const badges = awakenings.ids.map((id, i) => ({ token: `[awk:${id}]`, descriptor: awakenings.descriptors[i] }));
  return { orbs, types, badges };
}
