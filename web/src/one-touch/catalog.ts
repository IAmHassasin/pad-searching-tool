import raw from "./catalog.json";
import type { OneTouchCatalog } from "./types";

export const oneTouchCatalog = raw as OneTouchCatalog;

export const ONE_TOUCH_DUNGEONS = oneTouchCatalog.dungeons;

export const ONE_TOUCH_AWAKENING_EFFECTS = oneTouchCatalog.awakeningEffects;
