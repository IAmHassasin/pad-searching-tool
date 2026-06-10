#!/usr/bin/env node
/**
 * Generate awakening sprite manifest.json (v2 — grid with 1px gaps).
 *
 * Manual:
 *   node scripts/generate-awakening-manifest.mjs \
 *     --tile-width 31 --tile-height 32 --gap 1 \
 *     --columns 10 --rows 11 --last-row-icons 4 \
 *     --id-base 1
 *
 * Auto sprite dimensions (optional: npm i -D pngjs):
 *   node scripts/generate-awakening-manifest.mjs \
 *     --sprite web/src/assets/pad/awakenings/sprite.webp \
 *     --tile-width 31 --tile-height 32 --gap 1 \
 *     --columns 10 --rows 11 --last-row-icons 4
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultOut = resolve(
  root,
  "web/src/assets/pad/awakenings/manifest.json"
);

function parseArgs(argv) {
  const opts = {
    out: defaultOut,
    tileWidth: 31,
    tileHeight: 32,
    gap: 1,
    gapX: null,
    gapY: null,
    columns: 10,
    rows: null,
    lastRowIcons: null,
    regionX: 0,
    regionY: 0,
    spriteWidth: null,
    spriteHeight: null,
    idBase: 0,
    fallbackId: null,
    sprite: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--out") opts.out = resolve(root, next());
    else if (a === "--tile-width") opts.tileWidth = Number(next());
    else if (a === "--tile-height") opts.tileHeight = Number(next());
    else if (a === "--tile") {
      opts.tileWidth = Number(next());
      opts.tileHeight = opts.tileWidth;
    }
    else if (a === "--gap") opts.gap = Number(next());
    else if (a === "--gap-x") opts.gapX = Number(next());
    else if (a === "--gap-y") opts.gapY = Number(next());
    else if (a === "--columns") opts.columns = Number(next());
    else if (a === "--rows") opts.rows = Number(next());
    else if (a === "--last-row-icons") opts.lastRowIcons = Number(next());
    else if (a === "--region-x") opts.regionX = Number(next());
    else if (a === "--region-y") opts.regionY = Number(next());
    else if (a === "--sprite-width") opts.spriteWidth = Number(next());
    else if (a === "--sprite-height") opts.spriteHeight = Number(next());
    else if (a === "--id-base") opts.idBase = Number(next());
    else if (a === "--fallback-id") opts.fallbackId = Number(next());
    else if (a === "--sprite") opts.sprite = resolve(root, next());
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/generate-awakening-manifest.mjs [options]

Awakening region (fixed 10 columns typical):
  --columns <n>         Icons per row (default 10)
  --rows <n>            Total rows in region
  --last-row-icons <n>  Icons on last row (≤ columns)

Tile / gap:
  --tile-width <px>     Default 31
  --tile-height <px>    Default 32
  --gap <px>            Gap between icons (default 1)
  --region-x / --region-y   Region offset in sprite sheet

Sprite sheet:
  --sprite <path>       Sets spriteWidth/Height from image file
  --sprite-width / --sprite-height

Other:
  --id-base <n>         First awoken_skill_id at tile 0 (default 1)
  --out <path>
`);
      process.exit(0);
    }
  }

  opts.gapX ??= opts.gap;
  opts.gapY ??= opts.gap;
  return opts;
}

async function imageSize(path) {
  try {
    const { PNG } = await import("pngjs");
    const buf = readFileSync(path);
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height };
  } catch {
    try {
      const { default: sharp } = await import("sharp");
      const meta = await sharp(path).metadata();
      return { width: meta.width, height: meta.height };
    } catch {
      return null;
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.sprite) {
    if (!existsSync(opts.sprite)) {
      console.error(`Sprite not found: ${opts.sprite}`);
      process.exit(1);
    }
    const size = await imageSize(opts.sprite);
    if (!size?.width || !size?.height) {
      console.error(
        "Could not read sprite size. Install sharp or pngjs, or pass --sprite-width/--sprite-height."
      );
      process.exit(1);
    }
    opts.spriteWidth ??= size.width;
    opts.spriteHeight ??= size.height;
    console.log(`Sprite sheet: ${opts.spriteWidth}×${opts.spriteHeight}`);
  }

  if (opts.rows == null || opts.lastRowIcons == null) {
    console.error("Required: --rows and --last-row-icons");
    process.exit(1);
  }

  if (opts.spriteWidth == null || opts.spriteHeight == null) {
    console.error("Required: --sprite or --sprite-width + --sprite-height");
    process.exit(1);
  }

  if (opts.lastRowIcons > opts.columns) {
    console.error("--last-row-icons must be ≤ --columns");
    process.exit(1);
  }

  const capacity =
    (opts.rows - 1) * opts.columns + opts.lastRowIcons;
  const regionW = opts.columns * opts.tileWidth + (opts.columns - 1) * opts.gapX;
  const regionH = opts.rows * opts.tileHeight + (opts.rows - 1) * opts.gapY;

  const manifest = {
    version: 2,
    tileWidth: opts.tileWidth,
    tileHeight: opts.tileHeight,
    gapX: opts.gapX,
    gapY: opts.gapY,
    columns: opts.columns,
    rows: opts.rows,
    lastRowIcons: opts.lastRowIcons,
    regionX: opts.regionX,
    regionY: opts.regionY,
    spriteWidth: opts.spriteWidth,
    spriteHeight: opts.spriteHeight,
    idBase: opts.idBase,
    fallbackId: opts.fallbackId,
    overrides: {},
  };

  writeFileSync(opts.out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${opts.out}`);
  console.log(
    `Region ~${regionW}×${regionH}px, capacity ${capacity} icons (ids ${opts.idBase}–${opts.idBase + capacity - 1})`
  );
}

main();
