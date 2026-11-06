/**
 * Write the update.json manifest the Android app reads from
 * <repo>/releases/latest/download/update.json (see web/src/lib/app-update/manifest.ts).
 * Used by .github/workflows/cd.yml after the APK and the web bundle zip are built.
 *
 * Usage:
 *   node scripts/ci/write-update-manifest.mjs --tag v1.0.42 --version-code 42 \
 *     --native-api-level-file web/native-api-level.json \
 *     --apk dist-release/pad-searching-tool-v1.0.42.apk \
 *     --bundle dist-release/web-bundle-v1.0.42.zip \
 *     --out dist-release/update.json
 *
 * REPO_URL defaults to $GITHUB_SERVER_URL/$GITHUB_REPOSITORY.
 */
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--") || value === undefined) {
      throw new Error(`unexpected argument: ${key}`);
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function required(args, name) {
  const value = args[name];
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function parseNonNegativeInt(value, label) {
  if (!/^\d+$/.test(String(value))) throw new Error(`${label} must be an integer, got ${value}`);
  return Number(value);
}

const args = parseArgs(process.argv.slice(2));
const tag = required(args, "tag");
const versionCode = parseNonNegativeInt(required(args, "version-code"), "--version-code");
const levelFile = required(args, "native-api-level-file");
const apkPath = required(args, "apk");
const bundlePath = required(args, "bundle");
const outPath = required(args, "out");

const repoUrl =
  process.env.REPO_URL ??
  (() => {
    const repository = process.env.GITHUB_REPOSITORY;
    if (!repository) throw new Error("GITHUB_REPOSITORY or REPO_URL is required");
    return `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${repository}`;
  })();

const nativeApiLevel = parseNonNegativeInt(
  JSON.parse(readFileSync(levelFile, "utf8")).nativeApiLevel,
  "nativeApiLevel"
);

const assetUrl = (path) => `${repoUrl}/releases/download/${tag}/${basename(path)}`;
const asset = (path) => ({ url: assetUrl(path), sha256: sha256(path), size: statSync(path).size });

const manifest = {
  schema: 1,
  version: tag.replace(/^v/, ""),
  versionCode,
  nativeApiLevel,
  publishedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  bundle: asset(bundlePath),
  apk: asset(apkPath),
  notesUrl: `${repoUrl}/releases/tag/${tag}`,
};

const json = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(outPath, json);
console.log(`Wrote ${outPath}:\n${json}`);
