import type { ComponentType } from "react";
import type { EventLoadingThemeId, EventLoadingThemeProps } from "./types";
import { FadeTheme } from "./themes/FadeTheme";
import { ShojiSlideTheme } from "./themes/ShojiSlideTheme";
import { SwordSlashTheme } from "./themes/SwordSlashTheme";

const REGISTRY: Record<
  EventLoadingThemeId,
  { component: ComponentType<EventLoadingThemeProps>; defaultMinMs: number }
> = {
  "sword-slash": { component: SwordSlashTheme, defaultMinMs: 1400 },
  "shoji-slide": { component: ShojiSlideTheme, defaultMinMs: 1600 },
  fade: { component: FadeTheme, defaultMinMs: 600 },
};

export function getLoadingTheme(theme: EventLoadingThemeId) {
  return REGISTRY[theme] ?? REGISTRY.fade;
}

export function isLoadingThemeId(value: string): value is EventLoadingThemeId {
  return value in REGISTRY;
}
