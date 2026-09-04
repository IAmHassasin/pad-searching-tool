export type IconCropRect = {
  /** Normalized left (0–1 of image width). */
  x: number;
  /** Normalized top (0–1 of image height). */
  y: number;
  /**
   * Side length as a fraction of min(naturalWidth, naturalHeight).
   * Always produces a 1:1 square crop.
   */
  size: number;
};

/** Custom active-skill layout (matches dadguide compound skill types). */
export type CustomActiveSkillType =
  | "normal"
  | "evo"
  | "evo-loop"
  | "random";

export type CustomActiveSkillStage = {
  body: string;
  /** Max-level CD for this stage (shown on the stage line). */
  cd: number | null;
};

export const CUSTOM_ACTIVE_SKILL_HEADERS: Record<
  Exclude<CustomActiveSkillType, "normal">,
  string
> = {
  evo: "After each skill, evolve to the next",
  "evo-loop":
    "After each skill, evolve to the next looping around if the end is reached",
  random: "Activate a random skill from the list",
};

export type CustomCardDraft = {
  name: string;
  number: number | null;
  rarity: number;
  attribute1: number | null;
  attribute2: number | null;
  attribute3: number | null;
  type1: number | null;
  type2: number | null;
  type3: number | null;
  awakeningIds: number[];
  superAwakeningIds: number[];
  syncAwakeningId: number | null;
  prefixedMode: "super" | "sync";
  activeSkillType: CustomActiveSkillType;
  activeSkillName: string;
  activeSkillDesc: string;
  activeSkillStages: CustomActiveSkillStage[];
  activeSkillCdMin: number | null;
  activeSkillCdMax: number | null;
  leaderSkillName: string;
  leaderSkillDesc: string;
  hpMax: number | null;
  atkMax: number | null;
  rcvMax: number | null;
  artBlob: Blob | null;
  artObjectUrl: string | null;
  iconBlob: Blob | null;
  iconObjectUrl: string | null;
  iconCrop: IconCropRect | null;
};

export const MAX_ART_BYTES = 8 * 1024 * 1024;

export function createEmptyDraft(): CustomCardDraft {
  return {
    name: "",
    number: null,
    rarity: 7,
    attribute1: 0,
    attribute2: null,
    attribute3: null,
    type1: null,
    type2: null,
    type3: null,
    awakeningIds: [],
    superAwakeningIds: [],
    syncAwakeningId: null,
    prefixedMode: "super",
    activeSkillType: "normal",
    activeSkillName: "",
    activeSkillDesc: "",
    activeSkillStages: [
      { body: "", cd: null },
      { body: "", cd: null },
    ],
    activeSkillCdMin: null,
    activeSkillCdMax: null,
    leaderSkillName: "",
    leaderSkillDesc: "",
    hpMax: null,
    atkMax: null,
    rcvMax: null,
    artBlob: null,
    artObjectUrl: null,
    iconBlob: null,
    iconObjectUrl: null,
    iconCrop: null,
  };
}

export function formatAwakeningList(ids: number[]): string {
  return ids.map((id) => `(${id})`).join(",");
}

/** Build dadguide-style staged active skill description. */
export function composeActiveSkillDesc(draft: CustomCardDraft): string {
  if (draft.activeSkillType === "normal") {
    return draft.activeSkillDesc.trim();
  }
  const header = CUSTOM_ACTIVE_SKILL_HEADERS[draft.activeSkillType];
  const stages = draft.activeSkillStages
    .map((s) => s.body.trim())
    .filter(Boolean);
  if (!stages.length) return `${header}:`;
  const body = stages.map((text, i) => `${i + 1}) ${text}`).join(", ");
  return `${header}: ${body}`;
}

export function composeActiveSkillStageCooldowns(
  draft: CustomCardDraft
): string | null {
  if (draft.activeSkillType !== "evo" && draft.activeSkillType !== "evo-loop") {
    return null;
  }
  const cds = draft.activeSkillStages
    .filter((s) => s.body.trim())
    .map((s) => s.cd)
    .filter((cd): cd is number => cd != null && Number.isFinite(cd) && cd > 0);
  return cds.length ? cds.join(",") : null;
}
