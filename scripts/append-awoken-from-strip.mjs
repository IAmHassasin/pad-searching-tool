#!/usr/bin/env node
/**
 * Append new awakening icons from the vertical strip `awoken.png`
 * onto `sprite.webp` and bump manifest lastRowIcons / rows.
 *
 * Strip layout: left column, 31x32 tiles, no gap (row N = awoken_skill_id N).
 *
 *   node scripts/append-awoken-from-strip.mjs
 *   node scripts/append-awoken-from-strip.mjs --dry-run
 */
import { copyFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const defaultStrip = resolve(root, "web/src/assets/pad/awakenings/awoken.png");
const defaultSprite = resolve(root, "web/src/assets/pad/awakenings/sprite.webp");
const defaultManifest = resolve(
  root,
  "web/src/assets/pad/awakenings/manifest.json"
);

function parseArgs(argv) {
  const opts = {
    strip: defaultStrip,
    sprite: defaultSprite,
    manifest: defaultManifest,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--strip") opts.strip = resolve(root, next());
    else if (a === "--sprite") opts.sprite = resolve(root, next());
    else if (a === "--manifest") opts.manifest = resolve(root, next());
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/append-awoken-from-strip.mjs [--strip --sprite --manifest --dry-run]");
      process.exit(0);
    }
  }
  return opts;
}

function loadSharp() {
  const candidates = [
    resolve(root, "web/node_modules/sharp"),
    resolve(root, "node_modules/sharp"),
  ];
  for (const dir of candidates) {
    try {
      return require(dir);
    } catch {
      /* try next */
    }
  }
  throw new Error("sharp is required");
}

function maxTileIndex(m) {
  return (m.rows - 1) * m.columns + m.lastRowIcons - 1;
}

function capacity(m) {
  return maxTileIndex(m) + 1;
}

function gridForIndex(index, columns) {
  return {
    col: index % columns,
    row: Math.floor(index / columns),
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  const sharp = loadSharp();

  for (const [label, path] of [
    ["strip", opts.strip],
    ["sprite", opts.sprite],
    ["manifest", opts.manifest],
  ]) {
    if (!existsSync(path)) {
      console.error(label + " not found: " + path);
      process.exit(1);
    }
  }

  const manifest = JSON.parse(readFileSync(opts.manifest, "utf8"));
  const stripMeta = await sharp(opts.strip).metadata();
  if (!stripMeta.width || !stripMeta.height) {
    console.error("Could not read strip dimensions");
    process.exit(1);
  }

  const tileW = manifest.tileWidth;
  const tileH = manifest.tileHeight;
  const stripRows = Math.floor(stripMeta.height / tileH);
  const currentCap = capacity(manifest);
  const firstNewId = manifest.idBase + currentCap;
  const lastStripId = manifest.idBase + stripRows - 1;

  if (lastStripId < firstNewId) {
    console.log("No new icons (strip rows " + stripRows + ", mapped through id " + (manifest.idBase + currentCap - 1) + ")");
    return;
  }

  const newIds = [];
  for (let id = firstNewId; id <= lastStripId; id++) newIds.push(id);

  const composites = [];
  let nextRows = manifest.rows;
  let nextLastRowIcons = manifest.lastRowIcons;

  for (const id of newIds) {
    const index = id - manifest.idBase;
    const { col, row } = gridForIndex(index, manifest.columns);
    if (col >= manifest.columns) {
      console.error("col " + col + " exceeds columns " + manifest.columns);
      process.exit(1);
    }
    nextRows = Math.max(nextRows, row + 1);
    if (row === nextRows - 1) {
      nextLastRowIcons = col + 1;
    }
    const buf = await sharp(opts.strip)
      .extract({
        left: 0,
        top: (id - manifest.idBase) * tileH,
        width: tileW,
        height: tileH,
      })
      .png()
      .toBuffer();
    composites.push({
      input: buf,
      left: manifest.regionX + col * (tileW + manifest.gapX),
      top: manifest.regionY + row * (tileH + manifest.gapY),
    });
  }

  const nextManifest = {
    ...manifest,
    version: (manifest.version ?? 0) + 1,
    rows: nextRows,
    lastRowIcons: nextLastRowIcons,
  };

  console.log("Append ids " + newIds[0] + "-" + newIds[newIds.length - 1] + " (" + newIds.length + "), lastRowIcons " + manifest.lastRowIcons + "->" + nextLastRowIcons + ", rows " + manifest.rows + "->" + nextRows);

  if (opts.dryRun) return;

  const tmpSprite = opts.sprite + ".tmp.webp";
  await sharp(opts.sprite)
    .composite(composites)
    .webp({ lossless: true })
    .toFile(tmpSprite);
  copyFileSync(tmpSprite, opts.sprite);
  unlinkSync(tmpSprite);

  writeFileSync(opts.manifest, JSON.stringify(nextManifest, null, 2) + "\n");
  console.log("Wrote " + opts.sprite);
  console.log("Wrote " + opts.manifest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
