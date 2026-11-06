import { CapacitorHttp } from "@capacitor/core";
import type { ActionableDecision } from "./decide.ts";
import {
  DEFAULT_UPDATE_REPO_URL,
  manifestUrlFor,
  parseUpdateManifest,
  type UpdateManifest,
} from "./manifest.ts";
import { AppUpdate } from "./plugin.ts";

const HTTP_TIMEOUT_MS = 10_000;

export function updateRepoUrl(): string {
  return (
    (import.meta.env.VITE_UPDATE_REPO_URL as string | undefined)?.replace(/\/+$/, "") ??
    DEFAULT_UPDATE_REPO_URL
  );
}

export function updateManifestUrl(): string {
  return (
    (import.meta.env.VITE_UPDATE_MANIFEST_URL as string | undefined) ??
    manifestUrlFor(updateRepoUrl())
  );
}

/** Version baked into the running web bundle (CI sets APP_VERSION / APP_VERSION_CODE). */
export const RUNNING_BUNDLE = {
  version: __APP_VERSION__,
  versionCode: __APP_VERSION_CODE__,
  nativeApiLevel: __NATIVE_API_LEVEL__,
} as const;

/**
 * Native request: release assets on GitHub have no CORS headers, so the
 * WebView's `fetch` cannot read them. `CapacitorHttp` goes through Android.
 */
async function getText(url: string): Promise<string | null> {
  const response = await CapacitorHttp.get({
    url,
    connectTimeout: HTTP_TIMEOUT_MS,
    readTimeout: HTTP_TIMEOUT_MS,
    responseType: "text",
    headers: { Accept: "application/json" },
  });
  if (response.status !== 200) return null;
  const data: unknown = response.data;
  if (typeof data === "string") return data;
  // Native side may already have parsed JSON when the server labelled it as such.
  return JSON.stringify(data);
}

export async function fetchUpdateManifest(
  url: string = updateManifestUrl()
): Promise<UpdateManifest | null> {
  const text = await getText(url);
  if (text === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  return parseUpdateManifest(json, updateRepoUrl());
}

const notesCache = new Map<string, string | null>();

/** Release body (markdown) from the GitHub API; optional, cached, never throws. */
export async function fetchReleaseNotes(version: string): Promise<string | null> {
  const cached = notesCache.get(version);
  if (cached !== undefined) return cached;
  let notes: string | null = null;
  try {
    const repoPath = new URL(updateRepoUrl()).pathname.replace(/^\/+|\/+$/g, "");
    const text = await getText(
      `https://api.github.com/repos/${repoPath}/releases/tags/v${encodeURIComponent(version)}`
    );
    if (text !== null) {
      const json: unknown = JSON.parse(text);
      if (
        typeof json === "object" &&
        json !== null &&
        typeof (json as { body?: unknown }).body === "string"
      ) {
        notes = (json as { body: string }).body;
      }
    }
  } catch {
    notes = null;
  }
  notesCache.set(version, notes);
  return notes;
}

export async function runBundleUpdate(
  decision: Extract<ActionableDecision, { kind: "bundle" }>
): Promise<void> {
  const { manifest } = decision;
  await AppUpdate.downloadBundle({
    url: manifest.bundle.url,
    sha256: manifest.bundle.sha256,
    size: manifest.bundle.size,
    versionCode: manifest.versionCode,
  });
  // Reloads the WebView on success; nothing runs after this in the old page.
  await AppUpdate.applyBundle({ versionCode: manifest.versionCode });
}

export async function runApkUpdate(
  decision: Extract<ActionableDecision, { kind: "apk" }>
): Promise<{ needsPermission: boolean }> {
  const { manifest } = decision;
  const { path } = await AppUpdate.downloadApk({
    url: manifest.apk.url,
    sha256: manifest.apk.sha256,
    size: manifest.apk.size,
  });
  return AppUpdate.installApk({ path });
}
