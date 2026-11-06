/**
 * Inline icons inside skill text (orbs, lock, awakening badges such as the 7-combo mark).
 * OCR turns them into garbage, so they are found first as vivid blobs of about one line
 * height, classified against the orb / awakening sprites, painted out before OCR and merged
 * back into the recognised text as `[Fire]`-style tokens.
 *
 * Highlighted text (blue / red / cyan sentences) is vivid too; it is told apart from icons by
 * colour: a text glyph is a single hue, an icon has several hues (shading, highlights), and a
 * gold blob is an icon only when it is tall (the padlock) or multi-hue (the light orb).
 */
import { correlation, type Box, type RgbaImage } from "../team-build/screenshot/descriptor.ts";
import { AWAKENING_DESC_LENGTH, tileDescriptor } from "./awakening-match.ts";
import { attributeOfHue, ORB_TOKEN_BY_ATTRIBUTE } from "./attributes.ts";
import type { OcrLine } from "./ocr.ts";
import { clampBox, cropImage, hueSat, isBrightish, isGold, isVivid, isYellow, pixelAt, type Rgb } from "./pixels.ts";

export type IconBlob = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Share of the bounding box covered by non-background pixels. */
  fill: number;
  /** Share of the vivid pixels that fall in the dominant 30° hue bin (1 = one colour). */
  hueShare: number;
  /** Share of gold pixels in the bounding box (the lock icon). */
  goldShare: number;
  /** Share of lemon-yellow pixels. */
  yellowShare: number;
  /** Share of near-white pixels (orb highlights; coloured text has none). */
  whiteShare: number;
};

/** Near-white share from which a blob has an icon highlight. */
export const ICON_MIN_HIGHLIGHT = 0.025;

/** Below this fill ratio a blob is too sparse to be an icon (awakening badges with a dark inside sit near 0.45). */
export const ICON_MIN_FILL = 0.35;
/** A blob whose vivid pixels are almost all one hue is coloured text, not an icon. */
export const TEXT_HUE_SHARE = 0.92;
/** Gold share from which a blob may be the lock / light orb. */
export const ICON_GOLD_SHARE = 0.2;
/** Height / width from which a gold blob is the padlock rather than a glyph or an orb. */
export const LOCK_MIN_ASPECT = 1.15;

export type InlineIconTemplate = { token: string; descriptor: Uint8Array };
export type InlineIconTemplates = {
  /** Orb and lock tiles, cropped to their opaque bounds. */
  orbs: ReadonlyArray<InlineIconTemplate>;
  /** Monster type tiles (tokens "[type:ID]"). */
  types: ReadonlyArray<InlineIconTemplate>;
  /** Awakening tiles (tokens "[awk:ID]"). */
  badges: ReadonlyArray<InlineIconTemplate>;
};

/**
 * Monster type icons are square and single-coloured, like a bold yellow glyph; a real icon
 * scores ≈ 0.95 against its tile while glyphs stay below 0.8.
 */
export const TYPE_MIN_SCORE = 0.85;

export function typeIdOfToken(token: string): number | null {
  const m = /^\[type:(\d+)\]$/.exec(token);
  return m ? Number.parseInt(m[1], 10) : null;
}

export type InlineIcon = IconBlob & { token: string; score: number };

/** Orb template scores: sure above this, acceptable as a last resort above `ORB_MIN_SCORE`. */
export const ORB_SURE_SCORE = 0.75;
export const ORB_MIN_SCORE = 0.6;
/** A blob dominated by one hue family is an attribute orb (badges mix several hues). */
export const ORB_HUE_SHARE = 0.6;
/** Awakening badge scores: best candidate, and the floor for a badge the card itself carries. */
export const BADGE_MIN_SCORE = 0.75;
export const BADGE_OWN_MIN_SCORE = 0.68;
export const GENERIC_ICON_TOKEN = "[icon]";
/**
 * On the stage popup the coloured stage text (cyan names, yellow "N段階目") produces blobs that
 * look like icons; only confident template matches are kept there.
 */
export const POPUP_ORB_MIN_SCORE = 0.7;
export const POPUP_LOCK_MIN_SCORE = 0.8;

/** Whether a classified popup blob is a real icon (see the popup thresholds). */
export function isConfidentPopupIcon(icon: { token: string; score: number }): boolean {
  if (icon.token === GENERIC_ICON_TOKEN) return false;
  if (icon.token === LOCK_TOKEN) return icon.score >= POPUP_LOCK_MIN_SCORE;
  if (typeIdOfToken(icon.token) != null) return icon.score >= TYPE_MIN_SCORE;
  return icon.score >= POPUP_ORB_MIN_SCORE;
}
export const LOCK_TOKEN = "[Lock]";

export type FindIconOptions = {
  /** Pixels of the panel background to ignore (the stage popup is olive, which is vivid). */
  background?: (p: Rgb) => boolean;
  /**
   * Keep single-hue gold blobs too (type icons, and yellow stage text on the popup). The caller
   * then drops what the templates do not recognise (`isConfidentPopupIcon`).
   */
  keepGold?: boolean;
};

function isInk(p: Rgb): boolean {
  return isVivid(p, 60, 110) || isGold(p) || isBrightish(p);
}

/**
 * Connected components (8-neighbour) of vivid / gold pixels inside `box` whose size is about
 * one text line (`lineHeight`, image pixels), mostly filled, and not a single-hue glyph.
 */
export function findIconBlobs(img: RgbaImage, box: Box, lineHeight: number, options: FindIconOptions = {}): IconBlob[] {
  const { x0, y0, x1, y1 } = clampBox(img, box);
  const w = x1 - x0;
  const h = y1 - y0;
  const background = options.background ?? (() => false);
  const vivid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = pixelAt(img, x0 + x, y0 + y);
      if (!background(p) && (isVivid(p, 60, 110) || isGold(p))) vivid[y * w + x] = 1;
    }
  }
  const seen = new Uint8Array(w * h);
  const blobs: IconBlob[] = [];
  const minSize = lineHeight * 0.55;
  const maxSize = lineHeight * 1.35;
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!vivid[start] || seen[start]) continue;
    let bx0 = w;
    let by0 = h;
    let bx1 = -1;
    let by1 = -1;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop() as number;
      const x = i % w;
      const y = (i - x) / w;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (vivid[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    const bw = bx1 - bx0 + 1;
    const bh = by1 - by0 + 1;
    if (bw < minSize || bh < minSize || bw > maxSize || bh > maxSize) continue;
    if (bw / bh > 1.5 || bh / bw > 1.5) continue;
    let ink = 0;
    let gold = 0;
    let yellow = 0;
    let white = 0;
    let vividCount = 0;
    const bins = new Map<number, number>();
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        const p = pixelAt(img, x0 + x, y0 + y);
        if (background(p)) continue;
        if (isInk(p)) ink++;
        if (isGold(p)) gold++;
        if (isYellow(p)) yellow++;
        if (Math.min(p[0], p[1], p[2]) > 200) white++;
        if (isVivid(p, 60, 110)) {
          vividCount++;
          const bin = Math.floor(hueSat(p).hue / 30) % 12;
          bins.set(bin, (bins.get(bin) ?? 0) + 1);
        }
      }
    }
    const area = bw * bh;
    const fill = ink / area;
    const goldShare = gold / area;
    const yellowShare = yellow / area;
    const whiteShare = white / area;
    const hueShare = vividCount ? Math.max(...bins.values()) / vividCount : 0;
    if (fill < ICON_MIN_FILL) continue;
    const singleHue = hueShare >= TEXT_HUE_SHARE;
    const tall = bh / bw >= LOCK_MIN_ASPECT;
    const highlight = whiteShare >= ICON_MIN_HIGHLIGHT;
    const goldIcon = goldShare >= ICON_GOLD_SHARE && (tall || !singleHue || highlight || options.keepGold);
    if (singleHue && !goldIcon) continue;
    blobs.push({ x0: x0 + bx0, y0: y0 + by0, x1: x0 + bx1 + 1, y1: y0 + by1 + 1, fill, hueShare, goldShare, yellowShare, whiteShare });
  }
  blobs.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  return blobs;
}

/** Attribute orb of a mostly single-coloured blob, by the dominant hue of its vivid pixels. */
export function orbTokenByHue(img: RgbaImage, blob: IconBlob): string | null {
  const votes = new Array<number>(6).fill(0);
  let vivid = 0;
  for (let y = blob.y0; y < blob.y1; y++) {
    for (let x = blob.x0; x < blob.x1; x++) {
      const p = pixelAt(img, x, y);
      const { hue, sat } = hueSat(p);
      if (sat < 0.45 || Math.max(p[0], p[1], p[2]) < 110) continue;
      vivid++;
      votes[attributeOfHue(hue)]++;
    }
  }
  if (vivid < (blob.x1 - blob.x0) * (blob.y1 - blob.y0) * 0.2) return null;
  let best = 0;
  for (let i = 1; i < votes.length; i++) if (votes[i] > votes[best]) best = i;
  return votes[best] / vivid >= 0.5 ? ORB_TOKEN_BY_ATTRIBUTE[best] : null;
}

/** Best score per token over small offsets / scales of the blob (outline and glow need not match). */
function searchScores(
  img: RgbaImage,
  blob: IconBlob,
  templates: ReadonlyArray<InlineIconTemplate>
): Map<string, number> {
  const w = blob.x1 - blob.x0;
  const h = blob.y1 - blob.y0;
  const cx = blob.x0 + w / 2;
  const cy = blob.y0 + h / 2;
  const scores = new Map<string, number>();
  for (const scale of [0.85, 1, 1.15]) {
    for (let dy = -2; dy <= 2; dy += 2) {
      for (let dx = -2; dx <= 2; dx += 2) {
        const box: Box = { x: cx - (w * scale) / 2 + dx, y: cy - (h * scale) / 2 + dy, w: w * scale, h: h * scale };
        const desc = tileDescriptor(cropImage(img, box));
        for (const t of templates) {
          const score = correlation(desc, t.descriptor, AWAKENING_DESC_LENGTH);
          if (score > (scores.get(t.token) ?? -1)) scores.set(t.token, score);
        }
      }
    }
  }
  return scores;
}

function bestOf(scores: Map<string, number>): { token: string; score: number } {
  let best = { token: GENERIC_ICON_TOKEN, score: -1 };
  for (const [token, score] of scores) if (score > best.score) best = { token, score };
  return best;
}

export type ClassifyOptions = {
  /**
   * Awakening ids the card carries (its column and super awakening). A skill text that shows
   * an awakening badge almost always refers to one of them, so such a candidate wins over a
   * look-alike with a slightly higher score.
   */
  ownAwakeningIds?: ReadonlyArray<number>;
};

export function awakeningIdOfToken(token: string): number | null {
  const m = /^\[awk:(\d+)\]$/.exec(token);
  return m ? Number.parseInt(m[1], 10) : null;
}

/**
 * Token for a blob. Orb templates are tried first; the in-text orbs are drawn smaller and
 * outlined, so below a confident match the orb is read from its hue instead, gold blobs are
 * decided between the lock and the light orb, and awakening badges come last.
 */
export function classifyIconBlob(
  img: RgbaImage,
  blob: IconBlob,
  templates: InlineIconTemplates,
  options: ClassifyOptions = {}
): { token: string; score: number } {
  const w = blob.x1 - blob.x0;
  const h = blob.y1 - blob.y0;
  const orbScores = searchScores(img, blob, templates.orbs);
  const orb = bestOf(orbScores);
  if (orb.score >= ORB_SURE_SCORE) return orb;
  const type = bestOf(searchScores(img, blob, templates.types));
  if (type.score >= TYPE_MIN_SCORE && type.score > orb.score) return type;
  if (blob.goldShare >= ICON_GOLD_SHARE || blob.yellowShare >= ICON_GOLD_SHARE) {
    const lock = orbScores.get(LOCK_TOKEN) ?? -1;
    const light = orbScores.get("[Light]") ?? -1;
    // The padlock is taller than wide; orbs are round. Round gold blobs go to the better template.
    const tall = h / w >= LOCK_MIN_ASPECT;
    return tall || lock > light ? { token: LOCK_TOKEN, score: lock } : { token: "[Light]", score: light };
  }
  if (blob.hueShare >= ORB_HUE_SHARE) {
    const byHue = orbTokenByHue(img, blob);
    if (byHue) return { token: byHue, score: Math.max(orb.score, 0) };
  }
  if (orb.score >= ORB_MIN_SCORE) return orb;

  const badgeScores = searchScores(img, blob, templates.badges);
  const own = new Set(options.ownAwakeningIds ?? []);
  let ownBest = { token: GENERIC_ICON_TOKEN, score: -1 };
  for (const [token, score] of badgeScores) {
    const id = awakeningIdOfToken(token);
    if (id != null && own.has(id) && score > ownBest.score) ownBest = { token, score };
  }
  if (ownBest.score >= BADGE_OWN_MIN_SCORE) return ownBest;
  const badge = bestOf(badgeScores);
  if (badge.score >= BADGE_MIN_SCORE) return badge;
  return { token: GENERIC_ICON_TOKEN, score: Math.max(orb.score, badge.score) };
}

/** Icons as boxes to paint out before OCR (padded so no glow is left behind). */
export function iconBoxes(icons: ReadonlyArray<IconBlob>, pad = 3): Box[] {
  return icons.map((b) => ({ x: b.x0 - pad, y: b.y0 - pad, w: b.x1 - b.x0 + 2 * pad, h: b.y1 - b.y0 + 2 * pad }));
}

/**
 * Merge icon tokens into the OCR lines by position. The text is rebuilt from the recognised
 * symbols so that anything OCR invented where an icon was painted out (it tends to fill the
 * gap with a random kanji) is dropped: a symbol whose centre lies inside an icon is skipped
 * and the icon token is emitted in its place. Lines are joined without spaces (Japanese).
 */
export function mergeIconTokens(lines: ReadonlyArray<OcrLine>, icons: ReadonlyArray<InlineIcon>): string {
  const pending = [...icons];
  const out: string[] = [];
  for (const line of lines) {
    const yMid = (line.y0 + line.y1) / 2;
    const span = Math.max(8, line.y1 - line.y0);
    const mine = pending.filter((icon) => Math.abs((icon.y0 + icon.y1) / 2 - yMid) <= span * 0.75);
    for (const icon of mine) pending.splice(pending.indexOf(icon), 1);
    const items: Array<{ x: number; text: string }> = mine.map((icon) => ({ x: icon.x0, text: ` ${icon.token} ` }));
    for (const word of line.words) {
      const symbols = word.symbols?.length ? word.symbols : [{ text: word.text, x0: word.x0, x1: word.x1 }];
      let keep = "";
      let keepX = -1;
      for (const s of symbols) {
        const mid = (s.x0 + s.x1) / 2;
        if (mine.some((icon) => mid >= icon.x0 - 2 && mid <= icon.x1 + 2)) continue;
        if (keepX < 0) keepX = s.x0;
        keep += s.text;
      }
      if (keep) items.push({ x: keepX, text: keep });
      if (word.spaceAfter && keep) items.push({ x: word.x1, text: " " });
    }
    items.sort((a, b) => a.x - b.x);
    out.push(items.map((item) => item.text).join(""));
  }
  // Icons that matched no line (OCR found no words there) are appended so nothing is lost.
  for (const icon of pending) out.push(` ${icon.token} `);
  return out.join("\n").replace(/[ \t]+/g, " ").trim();
}
