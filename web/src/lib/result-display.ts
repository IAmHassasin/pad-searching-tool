export type ResultDisplaySections = {
  awk: boolean;
  activeSkill: boolean;
  leaderSkill: boolean;
};

export const DEFAULT_RESULT_DISPLAY_SECTIONS: ResultDisplaySections = {
  awk: true,
  activeSkill: false,
  leaderSkill: false,
};

export function isAllSectionsEnabled(sections: ResultDisplaySections): boolean {
  return sections.awk && sections.activeSkill && sections.leaderSkill;
}

export function hasAnyDisplaySection(sections: ResultDisplaySections): boolean {
  return sections.awk || sections.activeSkill || sections.leaderSkill;
}

export function setAllDisplaySections(
  enabled: boolean
): ResultDisplaySections {
  return {
    awk: enabled,
    activeSkill: enabled,
    leaderSkill: enabled,
  };
}
