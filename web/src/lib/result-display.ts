export type ResultDisplaySections = {
  awk: boolean;
  activeSkill: boolean;
  leaderSkill: boolean;
  /** Mobile detail panel: show full monster art (independent of All). */
  fullArt: boolean;
};

export const DEFAULT_RESULT_DISPLAY_SECTIONS: ResultDisplaySections = {
  awk: true,
  activeSkill: false,
  leaderSkill: false,
  fullArt: false,
};

export function isAllSectionsEnabled(sections: ResultDisplaySections): boolean {
  return sections.awk && sections.activeSkill && sections.leaderSkill;
}

export function hasAnyDisplaySection(sections: ResultDisplaySections): boolean {
  return sections.awk || sections.activeSkill || sections.leaderSkill;
}

/**
 * Mobile segmented tab over the result cards. `stats` is the full card
 * (all sections on) — the only layout that renders HP / ATK / RCV.
 */
export type ResultDisplayTab = "awakening" | "leader" | "active" | "stats";

export const RESULT_DISPLAY_TABS: { id: ResultDisplayTab; label: string }[] = [
  { id: "awakening", label: "Awakening" },
  { id: "leader", label: "Leader" },
  { id: "active", label: "Active" },
  { id: "stats", label: "Stats" },
];

/** Sections shown by `tab`; `fullArt` is carried over from `current`. */
export function sectionsForDisplayTab(
  tab: ResultDisplayTab,
  current: ResultDisplaySections
): ResultDisplaySections {
  return {
    awk: tab === "awakening" || tab === "stats",
    activeSkill: tab === "active" || tab === "stats",
    leaderSkill: tab === "leader" || tab === "stats",
    fullArt: current.fullArt,
  };
}

/** Tab matching `sections`, or null for mixed picks made in the display menu. */
export function displayTabFromSections(
  sections: ResultDisplaySections
): ResultDisplayTab | null {
  if (isAllSectionsEnabled(sections)) return "stats";
  if (sections.awk && !sections.activeSkill && !sections.leaderSkill) {
    return "awakening";
  }
  if (sections.leaderSkill && !sections.awk && !sections.activeSkill) {
    return "leader";
  }
  if (sections.activeSkill && !sections.awk && !sections.leaderSkill) {
    return "active";
  }
  return null;
}

/** Toggles awk / active / leader only — does not change `fullArt`. */
export function setAllDisplaySections(
  sections: ResultDisplaySections,
  enabled: boolean
): ResultDisplaySections {
  return {
    ...sections,
    awk: enabled,
    activeSkill: enabled,
    leaderSkill: enabled,
  };
}
