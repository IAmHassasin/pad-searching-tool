import jsQR from "jsqr";
import { PdcTeamStringError, parsePdcTeamString, type PdcTeam } from "./pdc-team-string.ts";

/** Same shape as `screenshot/descriptor.ts` RgbaImage (kept local so node tests stay light). */
export type QrScanImage = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };

export type QrScanResult =
  | { kind: "pdc"; text: string; team: PdcTeam }
  /** A QR code was found but its text is not a PDC team. */
  | { kind: "other"; text: string }
  | null;

/**
 * PDC images put a ~180 px QR (2 px per module) at the top-left of a 1080 px wide image.
 * This share of the width is searched first, upscaled so each module is ≥ 3 px.
 */
const CORNER_SHARE = 0.4;
const CORNER_UPSCALE = 3;
/** jsQR on a full phone screenshot is slow beyond this; larger frames are skipped. */
const FULL_SCAN_MAX_PIXELS = 2_500_000;

/** Copies `region` of `img`, scaled by an integer `factor` with nearest-neighbour sampling. */
export function cropScaled(
  img: QrScanImage,
  region: { x: number; y: number; width: number; height: number },
  factor: number,
): QrScanImage {
  const x0 = Math.max(0, Math.floor(region.x));
  const y0 = Math.max(0, Math.floor(region.y));
  const w = Math.max(1, Math.min(img.width - x0, Math.floor(region.width)));
  const h = Math.max(1, Math.min(img.height - y0, Math.floor(region.height)));
  const out = new Uint8ClampedArray(w * factor * h * factor * 4);
  const outW = w * factor;
  for (let y = 0; y < h * factor; y++) {
    const sy = y0 + Math.floor(y / factor);
    for (let x = 0; x < outW; x++) {
      const si = (sy * img.width + x0 + Math.floor(x / factor)) * 4;
      const di = (y * outW + x) * 4;
      out[di] = img.data[si];
      out[di + 1] = img.data[si + 1];
      out[di + 2] = img.data[si + 2];
      out[di + 3] = 255;
    }
  }
  return { width: outW, height: h * factor, data: out };
}

/** Text of the first QR code jsQR finds in `img`, or null. */
export function readQrText(img: QrScanImage): string | null {
  const data =
    img.data instanceof Uint8ClampedArray
      ? img.data
      : new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  const hit = jsQR(data, img.width, img.height, { inversionAttempts: "dontInvert" });
  return hit ? hit.data : null;
}

/** Classifies decoded QR text: a PDC team, or some other QR code. */
export function classifyQrText(text: string): QrScanResult {
  try {
    return { kind: "pdc", text, team: parsePdcTeamString(text) };
  } catch (err) {
    if (err instanceof PdcTeamStringError) return { kind: "other", text };
    throw err;
  }
}

/**
 * Looks for a PDC team QR in a screenshot: the top-left corner first (where PDC draws
 * it), then the whole image. Returns null when no QR code is found at all.
 */
export function findPdcTeamQr(img: QrScanImage): QrScanResult {
  const side = Math.round(Math.min(img.width, img.height, img.width * CORNER_SHARE));
  const attempts: Array<() => QrScanImage> = [
    () => cropScaled(img, { x: 0, y: 0, width: side, height: side }, CORNER_UPSCALE),
  ];
  if (img.width * img.height <= FULL_SCAN_MAX_PIXELS) attempts.push(() => img);

  let other: QrScanResult = null;
  for (const attempt of attempts) {
    const text = readQrText(attempt());
    if (text == null) continue;
    const result = classifyQrText(text);
    if (result?.kind === "pdc") return result;
    other ??= result;
  }
  return other;
}
