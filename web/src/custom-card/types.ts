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
  activeSkillName: string;
  activeSkillDesc: string;
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
    activeSkillName: "",
    activeSkillDesc: "",
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
