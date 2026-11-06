import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/**
 * JS surface of the local Capacitor plugin implemented in
 * web/android/app/src/main/java/com/hassasin/padsearchingtool/AppUpdatePlugin.java.
 * There is no web implementation: callers must gate on `isNativeApp()`.
 */

export type AppUpdateInfo = {
  versionName: string;
  versionCode: number;
  nativeApiLevel: number;
  /** Version code of the OTA bundle in use, or null when the built-in assets run. */
  bundleVersionCode: number | null;
  /** Version code of a bundle that was rolled back on the last launch, until acknowledged. */
  lastRollbackFrom: number | null;
  /** Whether Android currently lets this app open the package installer. */
  canInstallPackages: boolean;
};

export type DownloadProgress = { received: number; total: number };

export type AssetRequest = { url: string; sha256: string; size: number };

export interface AppUpdatePlugin {
  getInfo(): Promise<AppUpdateInfo>;
  /** Downloads, verifies and unpacks a web bundle; resolves when it is ready to apply. */
  downloadBundle(options: AssetRequest & { versionCode: number }): Promise<void>;
  /** Switches the WebView to a downloaded bundle and reloads the page. */
  applyBundle(options: { versionCode: number }): Promise<void>;
  /** Confirms the running bundle booted; must be called once per launch. */
  notifyReady(): Promise<void>;
  acknowledgeRollback(): Promise<void>;
  /** Drops every OTA bundle and reloads the assets shipped in the APK. */
  rollbackToBuiltin(): Promise<void>;
  downloadApk(options: AssetRequest): Promise<{ path: string }>;
  /** Opens the system installer, or the "install unknown apps" setting when not yet allowed. */
  installApk(options: { path: string }): Promise<{ needsPermission: boolean }>;
  addListener(
    eventName: "downloadProgress",
    listener: (progress: DownloadProgress) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "appResumed",
    listener: () => void
  ): Promise<PluginListenerHandle>;
}

export const AppUpdate = registerPlugin<AppUpdatePlugin>("AppUpdate");
