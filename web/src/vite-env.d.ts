/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_PAD_CDN_ORIGIN?: string;
  readonly VITE_PORTRAIT_CDN_BASE?: string;
  readonly VITE_ICON_CDN_BASE?: string;
  /** Overrides the GitHub repository the Android app updates from (default: this project). */
  readonly VITE_UPDATE_REPO_URL?: string;
  /** Overrides the full update.json URL, e.g. to point a debug build at a test release. */
  readonly VITE_UPDATE_MANIFEST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected by `define` in vite.config.ts.
declare const __APP_VERSION__: string;
declare const __APP_VERSION_CODE__: number;
declare const __NATIVE_API_LEVEL__: number;

declare module "*.json" {
  const value: Record<string, unknown>;
  export default value;
}
