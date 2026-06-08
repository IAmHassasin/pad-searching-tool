import { Logger } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SpaNotFoundFilter } from "./spa-not-found.filter";

/** Resolve Vite build dir (Docker: /app/public). Returns null if UI not bundled. */
export function resolveWebPublicRoot(): string | null {
  const root =
    process.env.WEB_STATIC_PATH?.trim() ||
    join(__dirname, "..", "public");
  return existsSync(join(root, "index.html")) ? root : null;
}

/** Static assets + SPA fallback via NotFound filter (Express 5 safe). */
export function setupWebStatic(
  app: NestExpressApplication,
  logger: Logger
): void {
  const root = resolveWebPublicRoot();
  if (!root) {
    logger.log("Web UI not bundled; API only.");
    return;
  }

  app.useStaticAssets(root, { index: false });
  app.useGlobalFilters(new SpaNotFoundFilter(root));
  logger.log(`Serving web UI from ${root}`);
}
