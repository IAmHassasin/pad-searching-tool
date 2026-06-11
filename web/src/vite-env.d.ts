/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_PAD_CDN_ORIGIN?: string;
  readonly VITE_PORTRAIT_CDN_BASE?: string;
  readonly VITE_ICON_CDN_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.json" {
  const value: Record<string, unknown>;
  export default value;
}
