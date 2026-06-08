import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.VITE_API_PROXY ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    },
  },
});
