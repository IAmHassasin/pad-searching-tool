import type { CSSProperties } from "react";
import {
  awakeningFallbackImageUrl,
  awakeningSpriteImageUrl,
  awakeningSpriteManifest,
} from "./awakening-sprite";

export type SkillEffectSpriteDef = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Active-skill effect icons carved from sprite.webp (separate from awakenings).
 *
 * - Col A: x 625–675, y 649…end, 50×50
 * - Col B: x 763–798, y 0–72, two tiles
 * - Col C: x 800–846, y 0…end, 50px tall
 */
function buildSkillEffectCatalog(
  spriteHeight = awakeningSpriteManifest.spriteHeight
): SkillEffectSpriteDef[] {
  const out: SkillEffectSpriteDef[] = [];
  let id = 1;

  const colACount = Math.floor((spriteHeight - 649) / 50);
  for (let i = 0; i < colACount; i++) {
    out.push({
      id: id++,
      x: 625,
      y: 649 + i * 50,
      width: 50,
      height: 50,
    });
  }

  // Two effects in 763–798 × 0–72
  const colBHeight = 36;
  for (let i = 0; i < 2; i++) {
    out.push({
      id: id++,
      x: 763,
      y: i * colBHeight,
      width: 35,
      height: colBHeight,
    });
  }

  const colCCount = Math.floor(spriteHeight / 50);
  for (let i = 0; i < colCCount; i++) {
    out.push({
      id: id++,
      x: 800,
      y: i * 50,
      width: 46,
      height: 50,
    });
  }

  return out;
}

export const SKILL_EFFECT_SPRITES = buildSkillEffectCatalog();

export const SKILL_EFFECT_BY_ID = new Map(
  SKILL_EFFECT_SPRITES.map((d) => [d.id, d])
);

const colAIds = SKILL_EFFECT_SPRITES.filter((d) => d.x === 625).map((d) => d.id);
const colBIds = SKILL_EFFECT_SPRITES.filter((d) => d.x === 763).map((d) => d.id);
const colCIds = SKILL_EFFECT_SPRITES.filter((d) => d.x === 800).map((d) => d.id);

/**
 * Semantic groups for the insert picker.
 * Col C layout (1-based within column): #1 + #14 → Skyfall; #2–13 → Type ATK;
 * #15–20 → Attribute ATK. Col A → Skyfall; Col B → Buff.
 */
export const SKILL_EFFECT_PICKER_GROUPS: {
  label: string;
  ids: number[];
}[] = [
  {
    label: "Skyfall Enhancement",
    ids: [...colAIds, colCIds[0], colCIds[13]].filter(
      (id): id is number => id != null
    ),
  },
  {
    label: "Buff",
    ids: colBIds,
  },
  {
    label: "Type ATK Buff",
    ids: colCIds.slice(1, 13),
  },
  {
    label: "Attribute ATK Buff",
    ids: colCIds.slice(14),
  },
];

export function getSkillEffectSpriteDef(
  effectId: number
): SkillEffectSpriteDef | null {
  return SKILL_EFFECT_BY_ID.get(effectId) ?? null;
}

export function skillEffectSpriteStyle(
  effectId: number,
  displayWidth?: number
): CSSProperties | null {
  const def = getSkillEffectSpriteDef(effectId);
  if (!def) return null;

  const m = awakeningSpriteManifest;
  const scale = (displayWidth ?? def.width) / def.width;

  return {
    width: def.width * scale,
    height: def.height * scale,
    backgroundImage: `url(${awakeningSpriteImageUrl})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${m.spriteWidth * scale}px ${m.spriteHeight * scale}px`,
    backgroundPosition: `${-def.x * scale}px ${-def.y * scale}px`,
  };
}

export { awakeningFallbackImageUrl };
