/**
 * Browser OCR of the Japanese text panels with tesseract.js. Workers and their language data
 * are loaded lazily on the first use (from the tesseract.js CDN defaults unless the
 * `VITE_TESSERACT_*` variables point elsewhere) and kept for the page lifetime.
 */
import { createWorker, type Worker } from "tesseract.js";
import type { Box, RgbaImage } from "../team-build/screenshot/descriptor.ts";
import { clampBox, isOlive, isTextLike, luminanceOf, pixelAt } from "./pixels.ts";

export type OcrSymbol = { text: string; x0: number; x1: number };

export type OcrWord = {
  text: string;
  confidence: number;
  /** Image coordinates (not the upscaled OCR canvas). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  symbols?: OcrSymbol[];
  /** Whether the recogniser put a space after this word. */
  spaceAfter?: boolean;
};

export type OcrLine = { text: string; words: OcrWord[]; y0: number; y1: number };

export type OcrResult = {
  text: string;
  /** Mean word confidence (0–100). */
  confidence: number;
  lines: OcrLine[];
};

/** Tesseract page segmentation: 7 = single line, 6 = block, 13 = raw line (no layout analysis). */
export type OcrSegmentation = "line" | "block" | "raw";

export type OcrOptions = {
  mode: OcrSegmentation;
  /**
   * "grey" keeps anti-aliasing (inverted luminance, best for white text); "mask" binarises
   * white-or-vivid pixels (coloured text on a textured background); "bright" keeps only
   * near-white pixels (the bold header number).
   */
  prep?: "grey" | "mask" | "bright" | "popup";
  /** Upscale factor before OCR (tesseract likes ~30 px x-height). */
  scale?: number;
  /** Pixels to paint out before recognition (inline icons), in image coordinates. */
  maskOut?: Box[];
  /** Language model; Japanese by default. "eng" reads the Latin header number better. */
  lang?: OcrLang;
};

/**
 * Japanese alone for the text panels: adding "eng" made the recogniser drift into Latin
 * garbage on mixed lines. The card number ("No.14301") is read with the English model.
 */
export type OcrLang = "jpn" | "eng";

function env(name: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  return value?.trim() || undefined;
}

const workers = new Map<OcrLang, Promise<Worker>>();

/** Shared worker per language; a failed initialisation can be retried. */
export function loadOcrWorker(lang: OcrLang = "jpn"): Promise<Worker> {
  let pending = workers.get(lang);
  if (!pending) {
    // Only set the paths that are configured: an explicit `undefined` would replace the
    // library's CDN defaults.
    const options: { workerPath?: string; corePath?: string; langPath?: string } = {};
    const workerPath = env("VITE_TESSERACT_WORKER_PATH");
    const corePath = env("VITE_TESSERACT_CORE_PATH");
    const langPath = env("VITE_TESSERACT_LANG_PATH");
    if (workerPath) options.workerPath = workerPath;
    if (corePath) options.corePath = corePath;
    if (langPath) options.langPath = langPath;
    pending = createWorker([lang], 1, options).catch((error: unknown) => {
      workers.delete(lang);
      throw error;
    });
    workers.set(lang, pending);
  }
  return pending;
}

/** Whether an OCR worker is already loaded (used to show the first-run download notice). */
export function ocrWorkerLoaded(): boolean {
  return workers.size > 0;
}

function prepValue(p: [number, number, number], prep: OcrOptions["prep"]): number {
  if (prep === "mask") return isTextLike(p) ? 0 : 255;
  if (prep === "bright") return Math.min(p[0], p[1], p[2]) > 200 ? 0 : 255;
  // Stage popup: white / cyan / yellow text on olive — flatten the olive to white and keep
  // the brightest channel so coloured text stays dark.
  if (prep === "popup") return isOlive(p) ? 255 : 255 - Math.max(p[0], p[1], p[2]);
  return 255 - Math.round(luminanceOf(p));
}

/** Black-on-white canvas of `box`, upscaled, ready for tesseract. */
export function prepareOcrCanvas(img: RgbaImage, box: Box, opts: OcrOptions): HTMLCanvasElement {
  const scale = opts.scale ?? 2;
  const { x0, y0, x1, y1 } = clampBox(img, box);
  const w = x1 - x0;
  const h = y1 - y0;
  const masked = (opts.maskOut ?? []).map((b) => clampBox(img, b));
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const ctx = small.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
  const out = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x0 + x;
      const py = y0 + y;
      const v = masked.some((m) => px >= m.x0 && px < m.x1 && py >= m.y0 && py < m.y1)
        ? 255
        : prepValue(pixelAt(img, px, py), opts.prep);
      const o = (y * w + x) * 4;
      out.data[o] = v;
      out.data[o + 1] = v;
      out.data[o + 2] = v;
      out.data[o + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const big = canvas.getContext("2d");
  if (!big) throw new Error("Canvas 2D is not available in this browser.");
  // Nearest-neighbour upscale: smoothing blurs the pixel font and costs recognition accuracy.
  big.imageSmoothingEnabled = false;
  big.drawImage(small, 0, 0, canvas.width, canvas.height);
  return canvas;
}

type Bbox = { x0: number; y0: number; x1: number; y1: number };
type TesseractSymbol = { text: string; bbox: Bbox };
type TesseractWord = { text: string; confidence: number; bbox: Bbox; symbols?: TesseractSymbol[] };
type TesseractLine = { text: string; words: TesseractWord[]; bbox: Bbox };
type TesseractBlock = { paragraphs: { lines: TesseractLine[] }[] };

const PSM: Record<OcrSegmentation, string> = { line: "7", block: "6", raw: "13" };

/** Recognise the text inside `box` of `img`. */
export async function recognizeBox(img: RgbaImage, box: Box, opts: OcrOptions): Promise<OcrResult> {
  const worker = await loadOcrWorker(opts.lang ?? "jpn");
  const scale = opts.scale ?? 2;
  const canvas = prepareOcrCanvas(img, box, { ...opts, scale });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM[opts.mode] as never,
    preserve_interword_spaces: "1",
  });
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  const { x0, y0 } = clampBox(img, box);
  const lines: OcrLine[] = [];
  const blocks = (data.blocks ?? []) as TesseractBlock[];
  for (const block of blocks) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const words: OcrWord[] = line.words
          .filter((w) => w.text.trim())
          .map((w) => ({
            text: w.text,
            confidence: w.confidence,
            x0: x0 + w.bbox.x0 / scale,
            y0: y0 + w.bbox.y0 / scale,
            x1: x0 + w.bbox.x1 / scale,
            y1: y0 + w.bbox.y1 / scale,
            symbols: w.symbols?.map((s) => ({
              text: s.text,
              x0: x0 + s.bbox.x0 / scale,
              x1: x0 + s.bbox.x1 / scale,
            })),
            spaceAfter: true,
          }));
        if (!words.length) continue;
        lines.push({
          text: line.text.trim(),
          words,
          y0: y0 + line.bbox.y0 / scale,
          y1: y0 + line.bbox.y1 / scale,
        });
      }
    }
  }
  const allWords = lines.flatMap((l) => l.words);
  const confidence = allWords.length
    ? allWords.reduce((sum, w) => sum + w.confidence, 0) / allWords.length
    : 0;
  return { text: data.text.trim(), confidence, lines };
}

/** Card number from the header ("No.14301" → 14301), null when no 3–5 digit number is found. */
export function parseCardNumber(text: string): number | null {
  // The English model reads a bold "1" as "l" / "I" now and then.
  const cleaned = text.replace(/\s+/g, "").replace(/No\.?/i, "").replace(/[lI|]/g, "1").replace(/[oO]/g, "0");
  const m = /(\d{3,5})/.exec(cleaned);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return n > 0 ? n : null;
}

/**
 * The header number read with the English model in two preprocessings plus the Japanese
 * model; two agreeing readings win, else the one with more digits (a dropped leading digit is
 * the usual failure).
 */
export async function recognizeCardNumber(
  img: RgbaImage,
  box: Box
): Promise<{ value: number | null; text: string; confidence: number }> {
  const variants = await Promise.all([
    recognizeBox(img, box, { mode: "raw", prep: "bright", scale: 3, lang: "eng" }),
    recognizeBox(img, box, { mode: "line", prep: "grey", scale: 2, lang: "eng" }),
    recognizeBox(img, box, { mode: "line", prep: "grey", scale: 2, lang: "jpn" }),
  ]);
  const candidates = variants.map((r) => ({ ...r, value: parseCardNumber(r.text) }));
  // A value two readings agree on wins; otherwise the longest reading, earliest variant first.
  const votes = new Map<number, number>();
  for (const c of candidates) if (c.value != null) votes.set(c.value, (votes.get(c.value) ?? 0) + 1);
  const agreed = [...votes].find(([, n]) => n >= 2)?.[0];
  const best =
    agreed != null
      ? candidates.find((c) => c.value === agreed)!
      : [...candidates].sort((a, b) => String(b.value ?? "").length - String(a.value ?? "").length)[0];
  return { value: best.value, text: best.text, confidence: best.confidence };
}

/** Release the workers (not needed in normal use; kept for tests / page teardown). */
export async function terminateOcrWorkers(): Promise<void> {
  const pending = [...workers.values()];
  workers.clear();
  await Promise.all(pending.map(async (p) => (await p).terminate()));
}
