import type { UpdateManifest } from "./manifest.ts";

export type InstalledInfo = {
  /** Android versionCode of the installed APK. */
  versionCode: number;
  /** Version code baked into the web bundle currently running (built-in or OTA). */
  bundleVersionCode: number | null;
  /** Native shell level compiled into the APK (BuildConfig.NATIVE_API_LEVEL). */
  nativeApiLevel: number;
};

export type UpdateDecision =
  | { kind: "none" }
  | { kind: "bundle"; manifest: UpdateManifest }
  | { kind: "apk"; manifest: UpdateManifest; reason: "native-shell" };

export type ActionableDecision = Exclude<UpdateDecision, { kind: "none" }>;

/** The newest code already present on the device, whichever channel delivered it. */
export function effectiveVersionCode(installed: InstalledInfo): number {
  return Math.max(installed.versionCode, installed.bundleVersionCode ?? 0);
}

/**
 * Picks the update channel for a manifest:
 * - nothing when the release is not newer than what already runs (never downgrade);
 * - the APK when the release needs a newer native shell than the one installed;
 * - the web bundle otherwise (no install prompt, data kept).
 */
export function decideUpdate(
  installed: InstalledInfo,
  manifest: UpdateManifest
): UpdateDecision {
  if (manifest.versionCode <= effectiveVersionCode(installed)) {
    return { kind: "none" };
  }
  if (manifest.nativeApiLevel > installed.nativeApiLevel) {
    return { kind: "apk", manifest, reason: "native-shell" };
  }
  return { kind: "bundle", manifest };
}
