/**
 * Browser pipeline: screenshot file → everything the translate page needs (numbers, rarity,
 * attributes, awakenings, OCR text, known/new decision, evolving-skill stages). Network is
 * used only for the icon index and the sprite sheet; text translation is a separate step
 * (`translate-texts.ts`).
 */
import { cropDataUrl, decodeImageFile, loadIconIndex } from "../team-build/screenshot/browser.ts";
import type { Box, RgbaImage } from "../team-build/screenshot/descriptor.ts";
import { descriptorForId } from "../team-build/screenshot/icon-index.ts";
import { readThumbAttributes, type ThumbAttributes } from "./attributes.ts";
import { matchAwakeningIcon, slotIsEmpty, type AwakeningMatch } from "./awakening-match.ts";
import { DIGIT_GLYPHS } from "./digit-glyphs.ts";
import { readTrailingDigits } from "./digits.ts";
import { identifyCard, type Identification } from "./identify.ts";
import {
  classifyIconBlob,
  findIconBlobs,
  iconBoxes,
  isConfidentPopupIcon,
  mergeIconTokens,
  type InlineIcon,
  type InlineIconTemplates,
} from "./inline-icons.ts";
import { jpTextLineHeight } from "./jp-text-layout.ts";
import { cleanOcrJapanese } from "./jp-text.ts";
import { detectDetailLayout, type DetailLayout } from "./layout.ts";
import { recognizeBox, recognizeCardNumber, type OcrLine } from "./ocr.ts";
import { clearWideRows, isOlive, isWhite, maskBox } from "./pixels.ts";
import { countStars } from "./rarity.ts";
import { readScreenNumbers, type ScreenNumbers } from "./read-numbers.ts";
import { loadAwakeningTemplates, loadInlineIconTemplates } from "./sprite-templates.ts";
import { findStagePopup, parseStageText, type SkillStages } from "./stages.ts";

export type TranslateStage =
  | "decode"
  | "layout"
  | "numbers"
  | "awakenings"
  | "identify"
  | "catalog"
  | "ocr"
  | "translate"
  | "assets"
  | "done";

export type OcrFields = {
  number: string;
  name: string;
  types: string;
  activeName: string;
  activeDesc: string;
  leaderName: string;
  leaderDesc: string;
};

/** Which screen the screenshot shows. */
export type ScreenKind = "detail" | "stage-popup";

export type AnalyzedScreenshot = {
  screen: ScreenKind;
  image: RgbaImage;
  layout: DetailLayout;
  numbers: ScreenNumbers;
  stars: number;
  attributes: ThumbAttributes;
  superAwakening: AwakeningMatch | null;
  awakenings: Array<AwakeningMatch | null>;
  ocr: OcrFields;
  /** Mean OCR word confidence per field (0–100). */
  ocrConfidence: Record<keyof OcrFields, number>;
  inlineIcons: InlineIcon[];
  /** Stages of an evolving skill, read from the stage popup. */
  stages: SkillStages | null;
  number: number | null;
  /** Whether the catalog's icon index has an entry for `number`. */
  numberIndexed: boolean;
  identification: Identification;
  /** Data URL of the thumbnail crop for the review UI. */
  thumbUrl: string;
  /** Observations worth showing (hidden panels, partial reads). */
  flags: string[];
};

export type StageReporter = (stage: TranslateStage) => void;

export type AnalyzeOptions = {
  /** Treat the screenshot as a new card even when the catalog knows it ("not this card"). */
  forceNew?: boolean;
};

const EMPTY_OCR: OcrFields = {
  number: "",
  name: "",
  types: "",
  activeName: "",
  activeDesc: "",
  leaderName: "",
  leaderDesc: "",
};
const EMPTY_CONFIDENCE: Record<keyof OcrFields, number> = {
  number: 0,
  name: 0,
  types: 0,
  activeName: 0,
  activeDesc: 0,
  leaderName: 0,
  leaderDesc: 0,
};

type DescriptionOptions = {
  popup?: boolean;
  ownAwakeningIds: number[];
};

async function readDescription(
  img: RgbaImage,
  box: Box,
  lineHeight: number,
  templates: InlineIconTemplates,
  opts: DescriptionOptions
): Promise<{ text: string; confidence: number; icons: InlineIcon[]; lines: OcrLine[] }> {
  const blobs = findIconBlobs(img, box, lineHeight, opts.popup ? { background: isOlive, keepGold: true } : {});
  let icons: InlineIcon[] = blobs.map((blob) => ({
    ...blob,
    ...classifyIconBlob(img, blob, templates, { ownAwakeningIds: opts.ownAwakeningIds }),
  }));
  if (opts.popup) icons = icons.filter(isConfidentPopupIcon);
  const result = await recognizeBox(img, box, {
    mode: "block",
    prep: opts.popup ? "popup" : "grey",
    maskOut: iconBoxes(icons),
  });
  const merged = icons.length ? mergeIconTokens(result.lines, icons) : result.text;
  const cleaned = merged
    .split("\n")
    .map(cleanOcrJapanese)
    .filter((l) => l.length > 0)
    .join("\n");
  return { text: cleaned, confidence: result.confidence, icons, lines: result.lines };
}

/**
 * The stage lines end with "ターン:N" in the white stats font; read the trailing digits with
 * the templates for the lines OCR left without a number.
 */
function fillStageTurns(img: RgbaImage, stages: SkillStages, lines: OcrLine[], layout: DetailLayout): void {
  const headers = lines.filter((l) => /段階目|最終段階/.test(l.text));
  stages.stages.forEach((stage, i) => {
    if (stage.turns != null) return;
    const line = headers[i];
    if (!line) return;
    // OCR line boxes sometimes span two lines; use the known line height instead.
    const lineHeight = jpTextLineHeight(layout);
    // The separator bar above a stage can fall inside the box; wide rows are cleared first.
    const box: Box = {
      x: layout.width * 0.72,
      y: line.y0 - 2 * layout.scale,
      w: layout.width * 0.27,
      h: lineHeight + 8 * layout.scale,
    };
    const read = readTrailingDigits(clearWideRows(maskBox(img, box, isWhite)), DIGIT_GLYPHS);
    if (read.value != null) stage.turns = read.value;
  });
}

/**
 * Full analysis of one screenshot. The card number (English OCR) and the thumbnail decide
 * first whether the catalog knows the card; the Japanese text is read only for new cards.
 * A stage popup hides the stats panel: then the stages are read and the rest is left empty.
 */
export async function analyzeScreenshot(
  file: Blob,
  report: StageReporter = () => {},
  options: AnalyzeOptions = {}
): Promise<AnalyzedScreenshot> {
  report("decode");
  const image = await decodeImageFile(file);
  report("layout");
  const layout = detectDetailLayout(image);
  const popup = findStagePopup(image);
  const flags: string[] = [];
  report("numbers");
  const numbers = readScreenNumbers(image, layout);
  const stars = countStars(image, layout.stars, layout.scale);
  const attributes = readThumbAttributes(image, layout.thumb);
  const thumbUrl = cropDataUrl(image, layout.thumb, 128);

  report("awakenings");
  const [awakeningTemplates, iconTemplates, index] = await Promise.all([
    loadAwakeningTemplates(),
    loadInlineIconTemplates(),
    loadIconIndex(),
  ]);
  const superAwakening = slotIsEmpty(image, layout.superAwakening)
    ? null
    : matchAwakeningIcon(image, layout.superAwakening, awakeningTemplates);
  const awakenings = layout.awakenings.map((box) =>
    slotIsEmpty(image, box) ? null : matchAwakeningIcon(image, box, awakeningTemplates)
  );
  const ownAwakeningIds = [...awakenings, superAwakening].flatMap((m) => (m ? [m.id] : []));

  report("identify");
  const number = await recognizeCardNumber(image, layout.number);
  const cardNumber = number.value;
  const numberIndexed = cardNumber != null && descriptorForId(index, cardNumber) != null;
  const lineHeight = jpTextLineHeight(layout);

  if (popup) {
    // Stats panel and thumbnail are covered: no numbers, no icon check; awakening slots under
    // the popup are unreliable too.
    flags.push("Stage popup screenshot: stats, level, cost and the thumbnail are hidden; add the normal detail screenshot of the same card for those.");
    // The thumbnail cannot be checked here: a catalog number is trusted on its own (flagged).
    const knownByNumber = numberIndexed && !options.forceNew;
    const identification: Identification = {
      kind: knownByNumber ? "known" : "new",
      id: knownByNumber ? cardNumber : null,
      iconScore: 0,
      numberScore: null,
      candidates: [],
      flags: knownByNumber
        ? ["identified by the header number only (thumbnail hidden by the stage popup)"]
        : ["thumbnail hidden by the stage popup"],
    };
    if (knownByNumber) {
      return {
        screen: "stage-popup",
        image,
        layout,
        numbers: emptyNumbers(numbers),
        stars,
        attributes: { attribute1: null, attribute2: null, attribute3: null },
        superAwakening,
        awakenings,
        ocr: { ...EMPTY_OCR, number: number.text },
        ocrConfidence: EMPTY_CONFIDENCE,
        inlineIcons: [],
        stages: null,
        number: cardNumber,
        numberIndexed,
        identification,
        thumbUrl,
        flags,
      };
    }
    report("ocr");
    const [name, types, leaderName] = await Promise.all([
      recognizeBox(image, layout.name, { mode: "line", prep: "grey" }),
      recognizeBox(image, layout.typeRow, { mode: "line", prep: "mask", scale: 3 }),
      recognizeBox(image, layout.leaderName, { mode: "line", prep: "mask" }),
    ]);
    const stageText = await readDescription(image, popup.text, lineHeight, iconTemplates, {
      popup: true,
      ownAwakeningIds,
    });
    const leaderDesc = await readDescription(image, layout.leaderDesc, lineHeight, iconTemplates, { ownAwakeningIds });
    const stages = parseStageText(stageText.text);
    if (stages) fillStageTurns(image, stages, stageText.lines, layout);
    else flags.push("The stage list could not be parsed from the popup text; check the Japanese.");
    const ocr: OcrFields = {
      ...EMPTY_OCR,
      number: number.text,
      name: cleanOcrJapanese(name.text),
      types: cleanOcrJapanese(types.text),
      activeName: stages?.stages[0]?.name ?? "",
      activeDesc: stages?.stages[0]?.body ?? stageText.text,
      leaderName: cleanOcrJapanese(leaderName.text),
      leaderDesc: leaderDesc.text,
    };
    return {
      screen: "stage-popup",
      image,
      layout,
      numbers: emptyNumbers(numbers),
      stars,
      attributes: { attribute1: null, attribute2: null, attribute3: null },
      superAwakening,
      awakenings: awakenings.map((m, i) => (layout.awakenings[i].y + layout.awakenings[i].h > popup.top ? null : m)),
      ocr,
      ocrConfidence: {
        ...EMPTY_CONFIDENCE,
        number: number.confidence,
        name: name.confidence,
        types: types.confidence,
        activeName: stageText.confidence,
        activeDesc: stageText.confidence,
        leaderName: leaderName.confidence,
        leaderDesc: leaderDesc.confidence,
      },
      inlineIcons: [...stageText.icons, ...leaderDesc.icons],
      stages,
      number: cardNumber,
      numberIndexed,
      identification,
      thumbUrl,
      flags,
    };
  }

  const identification = identifyCard(image, layout.thumb, index, cardNumber);
  if (options.forceNew && identification.kind === "known") {
    identification.flags.push(`treated as a new card on request (catalog match No.${identification.id} ignored)`);
    identification.kind = "new";
    identification.id = null;
  }
  const base = {
    screen: "detail" as const,
    image,
    layout,
    numbers,
    stars,
    attributes,
    superAwakening,
    awakenings,
    stages: null,
    number: cardNumber,
    numberIndexed,
    identification,
    thumbUrl,
    flags,
  };
  if (identification.kind === "known") {
    return { ...base, ocr: { ...EMPTY_OCR, number: number.text }, ocrConfidence: EMPTY_CONFIDENCE, inlineIcons: [] };
  }

  report("ocr");
  // Preprocessing per field was chosen on the sample screenshots: white text reads best as
  // inverted grey, the green leader-skill name and the type labels as a binary mask.
  const [name, types, activeName, leaderName] = await Promise.all([
    recognizeBox(image, layout.name, { mode: "line", prep: "grey" }),
    recognizeBox(image, layout.typeRow, { mode: "line", prep: "mask", scale: 3 }),
    recognizeBox(image, layout.activeName, { mode: "line", prep: "grey" }),
    recognizeBox(image, layout.leaderName, { mode: "line", prep: "mask" }),
  ]);
  const activeDesc = await readDescription(image, layout.activeDesc, lineHeight, iconTemplates, { ownAwakeningIds });
  const leaderDesc = await readDescription(image, layout.leaderDesc, lineHeight, iconTemplates, { ownAwakeningIds });

  const ocr: OcrFields = {
    number: number.text,
    name: cleanOcrJapanese(name.text),
    types: cleanOcrJapanese(types.text),
    // The skill name row also carries "Lv.最大 ターン:N" (often read as "Lu.最大"); keep the name only.
    activeName: cleanOcrJapanese(activeName.text).replace(/\s*L[uv]?\.?\s*最.*$/u, "").trim(),
    activeDesc: activeDesc.text,
    leaderName: cleanOcrJapanese(leaderName.text),
    leaderDesc: leaderDesc.text,
  };
  const ocrConfidence = {
    number: number.confidence,
    name: name.confidence,
    types: types.confidence,
    activeName: activeName.confidence,
    activeDesc: activeDesc.confidence,
    leaderName: leaderName.confidence,
    leaderDesc: leaderDesc.confidence,
  };
  return { ...base, ocr, ocrConfidence, inlineIcons: [...activeDesc.icons, ...leaderDesc.icons] };
}

function emptyNumbers(n: ScreenNumbers): ScreenNumbers {
  const none = { text: "", value: null, confidence: 0 };
  return { ...n, hp: none, atk: none, rcv: none, plusHp: none, plusAtk: none, plusRcv: none, level: none, maxLevel: none, cost: none, turns: none };
}

/** PNG blob of `box` (square output), for the icon of a new card when the CDN has none. */
export function cropToBlob(img: RgbaImage, box: Box, outSize = 120): Promise<Blob> {
  return fetch(cropDataUrl(img, box, outSize)).then((r) => r.blob());
}
