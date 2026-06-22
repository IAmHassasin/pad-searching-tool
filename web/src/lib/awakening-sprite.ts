import type { CSSProperties } from "react";
import manifest from "../assets/pad/awakenings/manifest.json";
import spriteUrl from "../assets/pad/awakenings/sprite.webp";
import fallbackIconUrl from "../assets/pad/awakenings/0.png";

export type AwakeningSpriteManifest = {
  version: number;
  tileWidth: number;
  tileHeight: number;
  gapX: number;
  gapY: number;
  /** Fixed columns per row in the awakening region. */
  columns: number;
  /** Total rows in the awakening region (including partial last row). */
  rows: number;
  /** Icon count on the last row (≤ columns). */
  lastRowIcons: number;
  /** Top-left of the awakening region within the sprite sheet. */
  regionX: number;
  regionY: number;
  /** Full sprite sheet dimensions (for background-size). */
  spriteWidth: number;
  spriteHeight: number;
  /** First awoken_skill_id mapped to tile index 0 (dadguide uses 1). */
  idBase: number;
  fallbackId: number | null;
  overrides?: Record<string, { col: number; row: number }>;
};

export const awakeningSpriteManifest = manifest as AwakeningSpriteManifest;

export const awakeningSpriteImageUrl = spriteUrl;
export const awakeningFallbackImageUrl = fallbackIconUrl;

export type AwakeningSpriteCoords = {
  col: number;
  row: number;
  x: number;
  y: number;
  tileWidth: number;
  tileHeight: number;
  spriteWidth: number;
  spriteHeight: number;
};

function strideX(m = awakeningSpriteManifest): number {
  return m.tileWidth + m.gapX;
}

function strideY(m = awakeningSpriteManifest): number {
  return m.tileHeight + m.gapY;
}

/** Highest valid linear tile index (0-based) in the awakening grid. */
export function maxAwakeningTileIndex(
  m: AwakeningSpriteManifest = awakeningSpriteManifest
): number {
  return (m.rows - 1) * m.columns + m.lastRowIcons - 1;
}

export function maxAwakeningSkillId(
  m: AwakeningSpriteManifest = awakeningSpriteManifest
): number {
  return m.idBase + maxAwakeningTileIndex(m);
}

/** Map awoken_skill_id → { col, row } in the awakening sprite region.
 *  Row-major: id 1 = top-left, id 2 = right, … id 10 = end of row 1, id 11 = row 2 col 1. */
export function awokenSkillIdToGrid(
  awokenSkillId: number,
  m: AwakeningSpriteManifest = awakeningSpriteManifest
): { col: number; row: number } | null {
  const override = m.overrides?.[String(awokenSkillId)];
  if (override) {
    if (override.row === m.rows - 1 && override.col >= m.lastRowIcons) return null;
    if (
      override.row < 0 ||
      override.row >= m.rows ||
      override.col < 0 ||
      override.col >= m.columns
    ) {
      return null;
    }
    return override;
  }

  const index = awokenSkillId - m.idBase;
  if (index < 0 || index > maxAwakeningTileIndex(m)) return null;

  return {
    col: index % m.columns,
    row: Math.floor(index / m.columns),
  };
}

export function getAwakeningSpriteCoords(
  awokenSkillId: number
): AwakeningSpriteCoords | null {
  const m = awakeningSpriteManifest;
  const override = m.overrides?.[String(awokenSkillId)];

  let col: number;
  let row: number;

  const grid = awokenSkillIdToGrid(awokenSkillId, m);
  if (!grid) return null;
  col = grid.col;
  row = grid.row;

  const x = -(m.regionX + col * strideX(m));
  const y = -(m.regionY + row * strideY(m));

  return {
    col,
    row,
    x,
    y,
    tileWidth: m.tileWidth,
    tileHeight: m.tileHeight,
    spriteWidth: m.spriteWidth,
    spriteHeight: m.spriteHeight,
  };
}

export function awakeningSpriteStyle(
  awokenSkillId: number,
  displayWidth?: number
): CSSProperties | null {
  const coords =
    getAwakeningSpriteCoords(awokenSkillId) ??
    (awakeningSpriteManifest.fallbackId != null
      ? getAwakeningSpriteCoords(awakeningSpriteManifest.fallbackId)
      : null);

  if (!coords) return null;

  const scale = (displayWidth ?? coords.tileWidth) / coords.tileWidth;

  return {
    width: coords.tileWidth * scale,
    height: coords.tileHeight * scale,
    backgroundImage: `url(${awakeningSpriteImageUrl})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${coords.spriteWidth * scale}px ${coords.spriteHeight * scale}px`,
    backgroundPosition: `${coords.x * scale}px ${coords.y * scale}px`,
  };
}

/** Column index of monster-type icons (11th icon in each row; cols 0–9 are awakenings). */
export const MONSTER_TYPE_SPRITE_COL = 10;

/** dadguide type_id → sprite row (row 0 = Dragon … row 11 = Redeemable Mats). */
export const MONSTER_TYPE_SPRITE_ROW: Record<number, number> = {
  4: 0,
  5: 1,
  7: 2,
  8: 3,
  1: 4,
  6: 5,
  2: 6,
  3: 7,
  0: 8,
  12: 9,
  14: 10,
  15: 11,
};

export function getMonsterTypeSpriteCoords(
  typeId: number
): AwakeningSpriteCoords | null {
  const row = MONSTER_TYPE_SPRITE_ROW[typeId];
  if (row === undefined) return null;

  const m = awakeningSpriteManifest;
  const col = MONSTER_TYPE_SPRITE_COL;
  const x = -(m.regionX + col * strideX(m));
  const y = -(m.regionY + row * strideY(m));

  return {
    col,
    row,
    x,
    y,
    tileWidth: m.tileWidth,
    tileHeight: m.tileHeight,
    spriteWidth: m.spriteWidth,
    spriteHeight: m.spriteHeight,
  };
}

export function monsterTypeSpriteStyle(
  typeId: number,
  displayWidth?: number
): CSSProperties | null {
  const coords = getMonsterTypeSpriteCoords(typeId);
  if (!coords) return null;

  const scale = (displayWidth ?? coords.tileWidth) / coords.tileWidth;

  return {
    width: coords.tileWidth * scale,
    height: coords.tileHeight * scale,
    backgroundImage: `url(${awakeningSpriteImageUrl})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${coords.spriteWidth * scale}px ${coords.spriteHeight * scale}px`,
    backgroundPosition: `${coords.x * scale}px ${coords.y * scale}px`,
  };
}

/** Attribute icons: x 576–625, 50×50px each, stacked vertically in sprite.webp. */
export const ATTRIBUTE_SPRITE_X = 576;
export const ATTRIBUTE_SPRITE_TILE = 50;

/** attribute_id → sprite row (0 = Fire … 6 = None). */
export const ATTRIBUTE_SPRITE_ROW: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
};

export function getMonsterAttributeSpriteCoords(
  attributeId: number
): AwakeningSpriteCoords | null {
  const row = ATTRIBUTE_SPRITE_ROW[attributeId];
  if (row === undefined) return null;

  const m = awakeningSpriteManifest;
  const x = -ATTRIBUTE_SPRITE_X;
  const y = -(row * ATTRIBUTE_SPRITE_TILE);

  return {
    col: 0,
    row,
    x,
    y,
    tileWidth: ATTRIBUTE_SPRITE_TILE,
    tileHeight: ATTRIBUTE_SPRITE_TILE,
    spriteWidth: m.spriteWidth,
    spriteHeight: m.spriteHeight,
  };
}

export function monsterAttributeSpriteStyle(
  attributeId: number,
  displayWidth?: number
): CSSProperties | null {
  const coords = getMonsterAttributeSpriteCoords(attributeId);
  if (!coords) return null;

  const scale = (displayWidth ?? coords.tileWidth) / coords.tileWidth;

  return {
    width: coords.tileWidth * scale,
    height: coords.tileHeight * scale,
    backgroundImage: `url(${awakeningSpriteImageUrl})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${coords.spriteWidth * scale}px ${coords.spriteHeight * scale}px`,
    backgroundPosition: `${coords.x * scale}px ${coords.y * scale}px`,
  };
}
