import { Logger } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { existsSync } from "node:fs";
import { join } from "node:path";

const API_PREFIXES = [
  "/health",
  "/source-records",
  "/category-bundles",
  "/filter-categories",
  "/pad-categorized",
  "/awoken-skills",
];

function isApiPath(path: string): boolean {
  return API_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
}

/** Serves Vite build output (Docker: /app/public). API routes keep priority. */
export function setupWebStatic(
  app: NestExpressApplication,
  logger: Logger
): void {
  const root =
    process.env.WEB_STATIC_PATH?.trim() ||
    join(__dirname, "..", "public");

  if (!existsSync(join(root, "index.html"))) {
    logger.log(`Web UI not bundled (${root}); API only.`);
    return;
  }

  app.useStaticAssets(root, { index: false });
  const http = app.getHttpAdapter().getInstance();
  http.get(
    "*",
    (
      req: { method: string; path: string },
      res: { sendFile: (p: string, cb: (err?: Error) => void) => void },
      next: (err?: Error) => void
    ) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      if (isApiPath(req.path)) {
        next();
        return;
      }
      res.sendFile(join(root, "index.html"), (err) => {
        if (err) next(err);
      });
    }
  );

  logger.log(`Serving web UI from ${root}`);
}
