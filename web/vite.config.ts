import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const apiTarget = process.env.VITE_API_PROXY ?? "http://localhost:3000";

// Native shell compatibility level shared with web/android/app/build.gradle.
const nativeApiLevel = Number(
  (
    JSON.parse(readFileSync(new URL("./native-api-level.json", import.meta.url), "utf8")) as {
      nativeApiLevel: number;
    }
  ).nativeApiLevel
);
if (!Number.isInteger(nativeApiLevel) || nativeApiLevel < 0) {
  throw new Error("native-api-level.json: nativeApiLevel must be a non-negative integer");
}

// CI exports APP_VERSION / APP_VERSION_CODE for release builds; local builds get placeholders.
const appVersion = process.env.APP_VERSION ?? "0.0.0-dev";
const appVersionCode = Number(process.env.APP_VERSION_CODE ?? 0);
if (!Number.isInteger(appVersionCode) || appVersionCode < 0) {
  throw new Error("APP_VERSION_CODE must be a non-negative integer");
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_VERSION_CODE__: String(appVersionCode),
    __NATIVE_API_LEVEL__: String(nativeApiLevel),
  },
  server: {
    port: 5173,
    proxy: {
      "/health": { target: apiTarget, changeOrigin: true },
      "/source-records": { target: apiTarget, changeOrigin: true },
      "/category-bundles": { target: apiTarget, changeOrigin: true },
      "/filter-categories": { target: apiTarget, changeOrigin: true },
      "/patterns": { target: apiTarget, changeOrigin: true },
      "/monsters": { target: apiTarget, changeOrigin: true },
      "/admin": { target: apiTarget, changeOrigin: true },
      "/pad-categorized": { target: apiTarget, changeOrigin: true },
      "/awoken-skills": { target: apiTarget, changeOrigin: true },
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
});
