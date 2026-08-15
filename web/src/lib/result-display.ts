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
