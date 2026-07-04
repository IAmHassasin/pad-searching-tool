import type { CSSProperties } from "react";
import {
  awakeningSpriteImageUrl,
  awakeningSpriteManifest,
} from "./awakening-sprite";
import skillHasteIconUrl from "../assets/pad/effect-filters/skill-haste.png";
import removeBarrierIconUrl from "../assets/pad/effect-filters/remove-barrier.png";
import nailOrbSkyfallIconUrl from "../assets/pad/effect-filters/nail-orb-skyfall.png";
import orbEnhancementIconUrl from "../assets/pad/effect-filters/orb-enhancement.png";
import leaderSwapIconUrl from "../assets/pad/effect-filters/leader-swap.png";

/** Effect filter icons in sprite.webp: x 763–797, 34×34px, 2px vertical gap. */
export const EFFECT_FILTER_SPRITE_X = 763;
export const EFFECT_FILTER_TILE_WIDTH = 34;
export const EFFECT_FILTER_TILE_HEIGHT = 34;
export const EFFECT_FILTER_GAP_Y = 2;

const EFFECT_FILTER_STRIDE_Y =
  EFFECT_FILTER_TILE_HEIGHT + EFFECT_FILTER_GAP_Y;

/**
 * Filter label → sprite row (top to bottom in sprite.webp).
 * Row 15 (inflict damage) and row 21 (bind) have no active filter icon.
 */
export const EFFECT_FILTER_ICON_ROW_BY_LABEL: Record<string, number> = {
  "RCV Burst": 0,
  "ATK Burst": 1,
  "Time Extend": 2,
  "Bind Recovery": 3,
  "Awk Bind Recovery": 4,
  "Unmatch Bind Recovery": 5,
  "Bypass Dmg Absorb": 6,
  "Bypass Att. Absorb": 7,
  "Pierce Damage Void": 8,
  "Create Spinner": 9,
  "Board Change": 10,
  "Mass Attack": 11,
  "Attribute Change": 12,
  "Damage Reduction": 13,
  "Add Combo": 14,
  "Skill Bind": 16,
  "Self ATK Burst": 17,
  "HP Multiplier Burst": 18,
  "Dmg Cap Break": 19,
  "Bypass Combo Absorb": 20,
  "Void Gravity": 22,
};

/** Filter labels with standalone PNG icons (not in sprite.webp). */
export const EFFECT_FILTER_STANDALONE_IMAGE_BY_LABEL: Record<string, string> = {
  "Skill Haste": skillHasteIconUrl,
  "Remove Barrier": removeBarrierIconUrl,
  "Nail Orb Skyfall": nailOrbSkyfallIconUrl,
  "Orb Enhancement": orbEnhancementIconUrl,
  "Leader Swap": leaderSwapIconUrl,
};

export function getEffectFilterIconRow(label: string): number | null {
  const row = EFFECT_FILTER_ICON_ROW_BY_LABEL[label];
  return row !== undefined ? row : null;
}

export function getEffectFilterStandaloneImage(label: string): string | null {
  return EFFECT_FILTER_STANDALONE_IMAGE_BY_LABEL[label] ?? null;
}

export function hasEffectFilterIcon(label: string): boolean {
  return (
    getEffectFilterIconRow(label) !== null ||
    getEffectFilterStandaloneImage(label) !== null
  );
}

export function effectFilterSpriteStyle(
  row: number,
  displayWidth?: number
): CSSProperties {
  const m = awakeningSpriteManifest;
  const scale =
    (displayWidth ?? EFFECT_FILTER_TILE_WIDTH) / EFFECT_FILTER_TILE_WIDTH;
  const x = -EFFECT_FILTER_SPRITE_X;
  const y = -(row * EFFECT_FILTER_STRIDE_Y);

  return {
    width: EFFECT_FILTER_TILE_WIDTH * scale,
    height: EFFECT_FILTER_TILE_HEIGHT * scale,
    backgroundImage: `url(${awakeningSpriteImageUrl})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${m.spriteWidth * scale}px ${m.spriteHeight * scale}px`,
    backgroundPosition: `${x * scale}px ${y * scale}px`,
  };
}
