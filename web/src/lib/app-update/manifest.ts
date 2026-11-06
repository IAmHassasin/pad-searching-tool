/**
 * `update.json` is published as a GitHub Release asset by the CD workflow
 * (see scripts/ci/write-update-manifest.sh). The app reads it from the stable
 * `releases/latest/download/update.json` URL, so no GitHub API call is needed.
 *
 * Pure module (no Capacitor, no Vite globals) so it can run under `node --test`.
 */

export const DEFAULT_UPDATE_REPO_URL =
  "https://github.com/IAmHassasin/pad-searching-tool";

export const UPDATE_MANIFEST_SCHEMA = 1;

export type UpdateAsset = {
  url: string;
  /** Lowercase hex SHA-256 of the asset file. */
  sha256: string;
  /** Size in bytes, used to cap the download and to show progress. */
  size: number;
};

export type UpdateManifest = {
  schema: typeof UPDATE_MANIFEST_SCHEMA;
  /** Release version, e.g. `1.0.42`. */
  version: string;
  /** Integer compared for ordering; equals the Android versionCode. */
  versionCode: number;
  /** Native shell level the bundle requires; see web/native-api-level.json. */
  nativeApiLevel: number;
  publishedAt: string | null;
  bundle: UpdateAsset;
  apk: UpdateAsset;
  notesUrl: string | null;
};

export function manifestUrlFor(repoUrl: string): string {
  return `${repoUrl.replace(/\/+$/, "")}/releases/latest/download/update.json`;
}

export function releaseAssetPrefixFor(repoUrl: string): string {
  return `${repoUrl.replace(/\/+$/, "")}/releases/download/`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInt(value: unknown): value is number {
  return isNonNegativeInt(value) && value > 0;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

function parseAsset(value: unknown, assetPrefix: string): UpdateAsset | null {
  if (!isRecord(value)) return null;
  const { url, sha256, size } = value;
  if (typeof url !== "string" || !url.startsWith(assetPrefix)) return null;
  if (typeof sha256 !== "string" || !SHA256_HEX.test(sha256)) return null;
  if (!isPositiveInt(size)) return null;
  return { url, sha256, size };
}

function parseOptionalString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  return value;
}

/**
 * Validates the manifest strictly: every field must have the expected shape and
 * every URL must point at a release asset of the configured repository. Returns
 * `null` for anything else so a tampered or half-uploaded manifest is ignored.
 */
export function parseUpdateManifest(
  input: unknown,
  repoUrl: string = DEFAULT_UPDATE_REPO_URL
): UpdateManifest | null {
  if (!isRecord(input)) return null;
  if (input.schema !== UPDATE_MANIFEST_SCHEMA) return null;

  const { version, versionCode, nativeApiLevel } = input;
  if (typeof version !== "string" || version.trim() === "") return null;
  if (!isPositiveInt(versionCode)) return null;
  if (!isNonNegativeInt(nativeApiLevel)) return null;

  const assetPrefix = releaseAssetPrefixFor(repoUrl);
  const bundle = parseAsset(input.bundle, assetPrefix);
  const apk = parseAsset(input.apk, assetPrefix);
  if (!bundle || !apk) return null;

  const publishedAt = parseOptionalString(input.publishedAt);
  if (publishedAt === undefined) return null;

  const notesUrl = parseOptionalString(input.notesUrl);
  if (notesUrl === undefined) return null;
  if (notesUrl !== null && !notesUrl.startsWith(repoUrl.replace(/\/+$/, ""))) {
    return null;
  }

  return {
    schema: UPDATE_MANIFEST_SCHEMA,
    version,
    versionCode,
    nativeApiLevel,
    publishedAt,
    bundle,
    apk,
    notesUrl,
  };
}
