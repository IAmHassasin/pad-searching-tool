export type EventLoadingThemeId = "sword-slash" | "shoji-slide" | "fade";

/** Seed / API config — add new themes by extending the union + registry. */
export type EventLoadingConfig = {
  theme: EventLoadingThemeId;
  /** Minimum wait before exit animation (default per theme). */
  minMs?: number;
  /**
   * Optional sprite URL for themes that use one (e.g. sword-slash).
   * Prefer files under `web/public/event-loading/` → path like `/event-loading/gintama-sword.png`.
   */
  asset?: string;
};

export type EventLoadingThemeProps = {
  /** `wait` = loop while assets load; `exit` = finish flourish then call onExitComplete. */
  phase: "wait" | "exit";
  onExitComplete: () => void;
  /** Theme-specific sprite (from seed `loading.asset`). */
  assetUrl?: string;
};
