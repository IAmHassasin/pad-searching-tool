/** Node-side PNG decoding into the `RgbaImage` shape used by the browser pipeline. */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { RgbaImage } from "../../web/src/lib/team-build/screenshot/descriptor.ts";

const require = createRequire(import.meta.url);

type PngModule = {
  PNG: { sync: { read(buffer: Buffer): { width: number; height: number; data: Buffer } } };
};

export function readPngImage(path: string): RgbaImage {
  const { PNG } = require("pngjs") as PngModule;
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}
