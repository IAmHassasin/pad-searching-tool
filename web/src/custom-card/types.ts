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

/**
 * Portrait art crop for the card middle frame.
 * Width is derived from `height` × {@link CUSTOM_CARD_ART_ASPECT}.
 * `x` / `y` may be outside 0–1 so the frame can hang past the image
 * (outside areas rasterize as transparent).
 */
export type ArtCropRect = {
  /** Normalized left (may be &lt; 0 or &gt; 1 — past image edges). */
  x: number;
  /** Normalized top (may be &lt; 0 or &gt; 1 — past image edges). */
  y: number;
  /** Crop height as a fraction of image height (may be &gt; 1). */
  height: number;
};

/**
 * Fixed portrait frame (width / height).
 * Calibrated from the Kirito custom-card export (~658×1024 ≈ 0.643).
 */
export const CUSTOM_CARD_ART_ASPECT = 2 / 3;

/** Output size for cropped card art (matches {@link CUSTOM_CARD_ART_ASPECT}). */
export const CUSTOM_CARD_ART_OUT_WIDTH = 720;
export const CUSTOM_CARD_ART_OUT_HEIGHT = 1080;

/** Custom active-skill layout (matches dadguide compound skill types). */
export type CustomActiveSkillType =
  | "normal"
  | "evo"
  | "evo-loop"
  | "random";

export type CustomActiveSkillStage = {
  /** Shown on the stage line (and as the card AS title when it is stage 1). */
  name: string;
  body: string;
  /** Max-level CD for this stage (shown on the stage line). */
  cd: number | null;
};

export function emptyActiveSkillStage(): CustomActiveSkillStage {
  return { name: "", body: "", cd: null };
}

export function activeSkillStageHasContent(
  stage: CustomActiveSkillStage
): boolean {
  return Boolean((stage.name ?? "").trim() || (stage.body ?? "").trim());
}

/** One numbered stage: `Name: body` when both are set. */
export function formatActiveSkillStageText(
  stage: CustomActiveSkillStage
): string {
  const name = (stage.name ?? "").trim();
  const body = (stage.body ?? "").trim();
  if (name && body) return `${name}: ${body}`;
  return name || body;
}

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
  /** Original uploaded PNG (icon crop source). */
  sourceArtBlob: Blob | null;
  sourceArtObjectUrl: string | null;
  /** Portrait-cropped art shown on the card. */
  artBlob: Blob | null;
  artObjectUrl: string | null;
  artCrop: ArtCropRect | null;
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
    activeSkillStages: [emptyActiveSkillStage(), emptyActiveSkillStage()],
    activeSkillCdMin: null,
    activeSkillCdMax: null,
    leaderSkillName: "",
    leaderSkillDesc: "",
    hpMax: null,
    atkMax: null,
    rcvMax: null,
    sourceArtBlob: null,
    sourceArtObjectUrl: null,
    artBlob: null,
    artObjectUrl: null,
    artCrop: null,
    iconBlob: null,
    iconObjectUrl: null,
    iconCrop: null,
  };
}

export function formatAwakeningList(ids: number[]): string {
  return ids.map((id) => `(${id})`).join(",");
}

/** Card header AS name: overall name, or stage 1 name when using evo/random. */
export function composeActiveSkillName(draft: CustomCardDraft): string {
  const overall = draft.activeSkillName.trim();
  if (draft.activeSkillType === "normal") return overall;
  return (draft.activeSkillStages[0]?.name ?? "").trim() || overall;
}

/** Build dadguide-style staged active skill description. */
export function composeActiveSkillDesc(draft: CustomCardDraft): string {
  if (draft.activeSkillType === "normal") {
    return draft.activeSkillDesc.trim();
  }
  const header = CUSTOM_ACTIVE_SKILL_HEADERS[draft.activeSkillType];
  const stages = draft.activeSkillStages
    .map(formatActiveSkillStageText)
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
    .filter(activeSkillStageHasContent)
    .map((s) => s.cd)
    .filter((cd): cd is number => cd != null && Number.isFinite(cd) && cd > 0);
  return cds.length ? cds.join(",") : null;
}
