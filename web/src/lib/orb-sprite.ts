import type { CSSProperties } from "react";
import {
  awakeningFallbackImageUrl,
  awakeningSpriteImageUrl,
  awakeningSpriteManifest,
} from "./awakening-sprite";

export type OrbSpriteDef = {
  id: number;
  key: string;
  label: string;
  /** Extra search terms (EN + JP). */
  aliases: string[];
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Board orbs in sprite.webp — 50×50 stack at x 625, y 0–500. */
const ORB_COL_X = 625;
const ORB_TILE = 50;

function orbTile(
  id: number,
  key: string,
  label: string,
  aliases: string[],
  row: number
): OrbSpriteDef {
  return {
    id,
    key,
    label,
    aliases,
    x: ORB_COL_X,
    y: row * ORB_TILE,
    width: ORB_TILE,
    height: ORB_TILE,
  };
}

/**
 * Orbs + orb-effect modifiers carved from sprite.webp.
 *
 * - Color / hazard orbs: x 625, 50×50, y 0…450
 * - Lock: same column, y 500
 * - Enhanced (+): 32×32 at 678,42
 * - Nail: 36×36 at 678,500
 */
export const ORB_SPRITES: OrbSpriteDef[] = [
  orbTile(1, "fire", "Fire", ["fire", "red", "火", "ファイア"], 0),
  orbTile(2, "water", "Water", ["water", "blue", "水", "ウォーター"], 1),
  orbTile(3, "wood", "Wood", ["wood", "green", "木", "ウッド"], 2),
  orbTile(4, "light", "Light", ["light", "yellow", "光", "ライト"], 3),
  orbTile(5, "dark", "Dark", ["dark", "purple", "闇", "ダーク"], 4),
  orbTile(6, "heal", "Heal", ["heal", "heart", "recovery", "rcv", "pink", "回復"], 5),
  orbTile(7, "jammer", "Jammer", ["jammer", "hazard", "お邪魔", "邪魔"], 6),
  orbTile(8, "poison", "Poison", ["poison", "毒"], 7),
  orbTile(9, "mortal-poison", "Mortal Poison", ["mortal", "deadly", "mortal poison", "猛毒"], 8),
  orbTile(10, "bomb", "Bomb", ["bomb", "爆弾"], 9),
  orbTile(11, "lock", "Lock", ["lock", "locked", "unlock", "ロック"], 10),
  {
    id: 12,
    key: "enhanced",
    label: "Enhanced",
    aliases: ["enhanced", "enhance", "plus", "plus orb", "barb", "barbs", "+", "強化"],
    x: 678,
    y: 42,
    width: 32,
    height: 32,
  },
  {
    id: 13,
    key: "nail",
    label: "Nail",
    aliases: ["nail", "nails", "spike", "spikes", "thorn", "トゲ"],
    x: 678,
    y: 500,
    width: 36,
    height: 36,
  },
];

export const ORB_BY_ID = new Map(ORB_SPRITES.map((d) => [d.id, d]));

export const ORB_PICKER_GROUPS: { label: string; ids: number[] }[] = [
  {
    label: "Orbs",
    ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    label: "Orb effects",
    ids: [12, 11, 13],
  },
];

export function getOrbSpriteDef(orbId: number): OrbSpriteDef | null {
  return ORB_BY_ID.get(orbId) ?? null;
}

export function orbSearchText(orbId: number): string {
  const def = getOrbSpriteDef(orbId);
  if (!def) return "";
  return [def.label, def.key, ...def.aliases].join(" ");
}

export function orbSpriteStyle(
  orbId: number,
  displayWidth?: number
): CSSProperties | null {
  const def = getOrbSpriteDef(orbId);
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
