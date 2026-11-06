/** Numbers of the stats / skill panels read with the digit templates, in one go. */
import type { RgbaImage } from "../team-build/screenshot/descriptor.ts";
import { DIGIT_GLYPHS } from "./digit-glyphs.ts";
import {
  readDigits,
  readPlusBonus,
  readTrailingDigits,
  type DigitsReadout,
} from "./digits.ts";
import type { DetailLayout } from "./layout.ts";
import { isTeal, isWhite, isYellow, maskBox } from "./pixels.ts";

/**
 * Numbers printed in the stats font. The card number in the header uses a different, bolder
 * font whose glyphs touch each other, so it is read by OCR instead (see `ocr.ts`).
 */
export type ScreenNumbers = {
  hp: DigitsReadout;
  atk: DigitsReadout;
  rcv: DigitsReadout;
  plusHp: DigitsReadout;
  plusAtk: DigitsReadout;
  plusRcv: DigitsReadout;
  level: DigitsReadout;
  maxLevel: DigitsReadout;
  cost: DigitsReadout;
  turns: DigitsReadout;
};

export function readScreenNumbers(img: RgbaImage, layout: DetailLayout): ScreenNumbers {
  const white = (box: typeof layout.hp) => maskBox(img, box, isWhite);
  const teal = (box: typeof layout.hp) => maskBox(img, box, isTeal);
  return {
    hp: readDigits(white(layout.hp), DIGIT_GLYPHS),
    atk: readDigits(white(layout.atk), DIGIT_GLYPHS),
    rcv: readDigits(white(layout.rcv), DIGIT_GLYPHS),
    // The "(+99)" bonuses are printed in yellow.
    plusHp: readPlusBonus(maskBox(img, layout.plusHp, isYellow), DIGIT_GLYPHS),
    plusAtk: readPlusBonus(maskBox(img, layout.plusAtk, isYellow), DIGIT_GLYPHS),
    plusRcv: readPlusBonus(maskBox(img, layout.plusRcv, isYellow), DIGIT_GLYPHS),
    level: readDigits(teal(layout.level), DIGIT_GLYPHS),
    maxLevel: readDigits(teal(layout.maxLevel), DIGIT_GLYPHS),
    cost: readTrailingDigits(white(layout.cost), DIGIT_GLYPHS),
    turns: readTrailingDigits(white(layout.turns), DIGIT_GLYPHS),
  };
}
