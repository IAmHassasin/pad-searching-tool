/**
 * The evolving-skill popup ("スキルを使用すると下記の順番で進化します。"): an olive panel over the
 * detail screen listing every stage of a multi-stage active skill. The pixel part finds the
 * panel; the text part turns the OCR'd lines into stages.
 */
import type { Box, RgbaImage } from "../team-build/screenshot/descriptor.ts";
import { isOlive, pixelAt } from "./pixels.ts";

/** Share of a row that must be olive for the row to belong to the popup. */
const POPUP_ROW_SHARE = 0.5;
/** Minimum popup height as a share of the image height (a stage list is at least two stages). */
const POPUP_MIN_HEIGHT = 0.12;

export type StagePopup = {
  /** Olive panel rows (inclusive top, exclusive bottom). */
  top: number;
  bottom: number;
  /** Text area inside the panel. */
  text: Box;
};

/** The stage popup when one covers the screen, else null. */
export function findStagePopup(img: RgbaImage): StagePopup | null {
  const { width, height } = img;
  const step = Math.max(1, Math.floor(width / 400));
  let top = -1;
  let bottom = -1;
  for (let y = Math.floor(height * 0.2); y < height * 0.95; y++) {
    let n = 0;
    let total = 0;
    for (let x = 0; x < width; x += step) {
      total++;
      if (isOlive(pixelAt(img, x, y))) n++;
    }
    if (n / total >= POPUP_ROW_SHARE) {
      if (top < 0) top = y;
      bottom = y + 1;
    }
  }
  if (top < 0 || bottom - top < height * POPUP_MIN_HEIGHT) return null;
  const inset = Math.round(width * 0.06);
  const pad = Math.round(width * 0.012);
  return {
    top,
    bottom,
    text: { x: inset, y: top + pad, w: width - 2 * inset, h: bottom - top - 2 * pad },
  };
}

export type SkillStage = {
  /** 1-based stage number; the last stage is `final`. */
  index: number;
  final: boolean;
  name: string;
  body: string;
  /** Cooldown at max skill level, when printed on the stage line. */
  turns: number | null;
};

export type SkillStages = {
  kind: "evo" | "evo-loop";
  stages: SkillStage[];
};

const INTRO = /スキルを使用すると/;
const STAGE_HEADER = /^(?:(\d+)\s*段階目|(最終段階))\s*[:：]?\s*(.*)$/;
const TURNS_AT_END = /(?:ターン|ター)\s*[:：]?\s*(\d+)?\s*[。.]?\s*$/;
/** "Lv.1 ターン:7 (最大Lv.5 ターン:3)" → max-level turns 3. */
/** "Lv.1 ターン:7 (最大Lv.5 ターン:3)"; OCR renders "Lv" as "Lu" / "Ln". */
const LEVEL_LINE = /^L[a-z]{0,2}[\s.:]|最大\s*L[a-z]{1,2}/i;
const MAX_TURNS = /最大\s*L[a-z]{1,2}\S{0,4}?\s*ターン\s*[:：]?\s*(\d+)/i;
/** "使用後に1段階目に戻る" (back to stage 1 after use); OCR may glue it to the previous line. */
const LOOP_MARK = /使用後に\s*1\s*.?階目\s*に戻る[。.]?/;

/** Parse the OCR'd popup text (one line per text line) into stages. */
export function parseStageText(text: string): SkillStages | null {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const stages: SkillStage[] = [];
  let loop = false;
  let current: SkillStage | null = null;
  for (const line of lines) {
    if (INTRO.test(line)) continue;
    let text = line;
    const loopMark = LOOP_MARK.exec(text);
    if (loopMark) {
      loop = true;
      text = (text.slice(0, loopMark.index) + text.slice(loopMark.index + loopMark[0].length)).trim();
      if (!text) continue;
    }
    const header = STAGE_HEADER.exec(text);
    if (header) {
      const final = Boolean(header[2]);
      let rest = header[3] ?? "";
      let turns: number | null = null;
      const t = TURNS_AT_END.exec(rest);
      if (t) {
        turns = t[1] ? Number.parseInt(t[1], 10) : null;
        rest = rest.slice(0, t.index);
      }
      current = {
        index: final ? stages.length + 1 : Number.parseInt(header[1], 10),
        final,
        name: rest.replace(/[\s。.]+$/g, "").trim(),
        body: "",
        turns,
      };
      stages.push(current);
      continue;
    }
    if (!current) continue;
    if (LEVEL_LINE.test(text)) {
      const m = MAX_TURNS.exec(text);
      if (m) current.turns = Number.parseInt(m[1], 10);
      continue;
    }
    current.body = current.body ? `${current.body}${text}` : text;
  }
  if (stages.length < 2) return null;
  return { kind: loop ? "evo-loop" : "evo", stages };
}
