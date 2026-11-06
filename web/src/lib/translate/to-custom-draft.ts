/** Assemble a Custom Card draft from the analysed screenshot, the translated texts and the art. */
import { applyArtCropFromUrl } from "../../custom-card/ArtCropModal";
import { artCropWidthNorm } from "../../custom-card/art-crop";
import { createEmptyDraft, type ArtCropRect, type CustomCardDraft } from "../../custom-card/types";
import { AWAKENING_DRAFT_MIN_SCORE } from "./awakening-match.ts";
import { parseJpTypeLabels } from "./jp-types.ts";
import { cropToBlob, type AnalyzedScreenshot } from "./pipeline.ts";
import type { TranslatedTexts } from "./translate-texts.ts";

export type DraftArt = {
  /** CDN portrait when the CDN has one; otherwise the art is cut from the screenshot. */
  portrait: Blob | null;
  /** CDN icon when the CDN has one; otherwise the thumbnail is cut from the screenshot. */
  icon: Blob | null;
};

export type DraftBuild = {
  draft: CustomCardDraft;
  artSource: "cdn" | "screenshot";
  iconSource: "cdn" | "screenshot" | "none";
};

/** 2:3 frame centred on the art area of the screenshot, as the custom card's normalised crop. */
export function screenshotArtCrop(a: AnalyzedScreenshot): ArtCropRect {
  const { width, height } = a.image;
  const box = a.layout.art;
  const heightNorm = box.h / height;
  const widthNorm = artCropWidthNorm(heightNorm, width, height);
  return {
    x: (box.x + box.w / 2) / width - widthNorm / 2,
    y: box.y / height,
    height: heightNorm,
  };
}

/**
 * Write the stages of an evolving skill into a draft (type, stage list, first-stage name and
 * cooldown). Leaves the draft alone when `texts` carries no stages.
 */
export function applyStagesToDraft(draft: CustomCardDraft, texts: Pick<TranslatedTexts, "stages">): void {
  if (!texts.stages || texts.stages.stages.length < 2) return;
  draft.activeSkillType = texts.stages.kind;
  draft.activeSkillStages = texts.stages.stages.map((s) => ({ name: s.name, body: s.body, cd: s.turns }));
  draft.activeSkillName = texts.stages.stages[0].name;
  draft.activeSkillDesc = "";
  draft.activeSkillCdMin = texts.stages.stages[0].turns;
  draft.activeSkillCdMax = null;
}

export async function buildCustomCardDraft(
  a: AnalyzedScreenshot,
  texts: TranslatedTexts,
  art: DraftArt,
  screenshot: Blob
): Promise<DraftBuild> {
  const draft = createEmptyDraft();
  draft.name = texts.name.trim() || a.ocr.name;
  draft.nameJa = a.ocr.name;
  draft.number = a.number;
  draft.rarity = a.stars > 0 ? Math.min(10, a.stars) : draft.rarity;
  draft.attribute1 = a.attributes.attribute1;
  draft.attribute2 = a.attributes.attribute2;
  draft.attribute3 = a.attributes.attribute3;
  const [type1 = null, type2 = null, type3 = null] = parseJpTypeLabels(a.ocr.types);
  draft.type1 = type1;
  draft.type2 = type2;
  draft.type3 = type3;
  draft.awakeningIds = a.awakenings.flatMap((m) => (m && m.score >= AWAKENING_DRAFT_MIN_SCORE ? [m.id] : []));
  draft.superAwakeningIds = a.superAwakening ? [a.superAwakening.id] : [];
  draft.prefixedMode = "super";
  applyStagesToDraft(draft, texts);
  if (draft.activeSkillType === "normal") {
    draft.activeSkillName = texts.activeName;
    draft.activeSkillDesc = texts.activeDesc;
    draft.activeSkillCdMin = a.numbers.turns.value;
    draft.activeSkillCdMax = null;
  }
  draft.leaderSkillName = texts.leaderName;
  draft.leaderSkillDesc = texts.leaderDesc;
  draft.hpMax = a.numbers.hp.value;
  draft.atkMax = a.numbers.atk.value;
  draft.rcvMax = a.numbers.rcv.value;
  draft.level = a.numbers.level.value;
  draft.maxLevel = a.numbers.maxLevel.value;
  draft.plusHp = a.numbers.plusHp.value;
  draft.plusAtk = a.numbers.plusAtk.value;
  draft.plusRcv = a.numbers.plusRcv.value;
  draft.cost = a.numbers.cost.value;

  let artSource: DraftBuild["artSource"];
  if (art.portrait) {
    artSource = "cdn";
    draft.sourceArtBlob = art.portrait;
    draft.sourceArtObjectUrl = URL.createObjectURL(art.portrait);
    const { crop, blob } = await applyArtCropFromUrl(draft.sourceArtObjectUrl, null);
    draft.artCrop = crop;
    draft.artBlob = blob;
    draft.artObjectUrl = URL.createObjectURL(blob);
  } else {
    artSource = "screenshot";
    draft.sourceArtBlob = screenshot;
    draft.sourceArtObjectUrl = URL.createObjectURL(screenshot);
    const { crop, blob } = await applyArtCropFromUrl(draft.sourceArtObjectUrl, screenshotArtCrop(a));
    draft.artCrop = crop;
    draft.artBlob = blob;
    draft.artObjectUrl = URL.createObjectURL(blob);
  }

  // The thumbnail is hidden on a stage-popup screenshot, so only a CDN icon can be used there.
  const icon = art.icon ?? (a.screen === "detail" ? await cropToBlob(a.image, a.layout.thumb, 120) : null);
  const iconSource: DraftBuild["iconSource"] = art.icon ? "cdn" : icon ? "screenshot" : "none";
  draft.iconBlob = icon;
  draft.iconObjectUrl = icon ? URL.createObjectURL(icon) : null;
  draft.iconCrop = null;

  return { draft, artSource, iconSource };
}
