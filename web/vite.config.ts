import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const apiTarget = process.env.VITE_API_PROXY ?? "http://localhost:3000";

/** Capacitor APK must not ship Monetag vignette / service-worker ads. */
function omitMonetagOnAndroid(mode: string): Plugin {
  return {
    name: "omit-monetag-on-android",
    transformIndexHtml(html) {
      if (mode !== "android") return html;
      return html.replace(
        /<!-- monetag-vignette -->[\s\S]*?<!-- \/monetag-vignette -->\s*/g,
        ""
      );
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), omitMonetagOnAndroid(mode)],
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
}));
