#!/usr/bin/env node
/**
 * Single entry CLI: loads project `.env`, then runs build / docker / Nest jobs.
 * Usage: `npm run pad -- <cmd> [...]`
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

function loadEnvFile() {
  if (!existsSync(envPath)) {
    console.error(
      `Missing ${path.relative(process.cwd(), envPath)} — copy .env.example to .env`
    );
    process.exit(1);
  }
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const unexport = trimmed.replace(/^export\s+/, "");
    const eq = unexport.indexOf("=");
    if (eq <= 0) continue;
    const key = unexport.slice(0, eq).trim();
    let val = unexport.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function run(cmd, args, overrides = {}) {
  const shell =
    process.platform === "win32" &&
    (cmd === "npm" || cmd === "npx");
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...overrides },
    shell,
  });
  const code = typeof r.status === "number" ? r.status : 1;
  if (code !== 0) process.exit(code);
}

function npmBuild() {
  run("npm", ["run", "build"]);
}

function runDist(script, overrides = {}) {
  run(process.execPath, [path.join(root, "dist", script)], overrides);
}

function printHelp() {
  console.log(`pad-searching-tool — npm run pad -- <command>

Loads .env from the project root, then runs a command.

  build       TypeScript compile only (nest build).
  snapshot    Forces IMPORT_MODE=download — immutable file at SNAPSHOT_OUTPUT_PATH.
  seed-db     Download community SQLite → seed/dadguide.sqlite (DB_DOWNLOAD_URL in .env).
  import-vanish-db       Fetch GameWith vanish grants → gamewith-vanish.sqlite.
  generate-vanish-map    Regenerate vanish-awoken-name-map.json from dadguide Untranslated rows.
  dungeon:gimmick-master  Merge gimmick master from AppMedia URL(s) (--urls dungeon-details/seed/dungeon-urls.txt).
  dungeon:import          Parse dungeon guide URL(s) → dungeon-details/seed/dungeons/<id>.json.
  merge       import-external-db (IMPORT_MODE from .env: merge | replace).
  transform   categorize only (START_HTTP=false, RUN_TRANSFORM=true).
  serve       HTTP server (forces START_HTTP=true; other vars from .env).
  update      merge import then transform (job, no HTTP).
  compose     docker compose <args…> — e.g. compose up --build

Examples:
  npm run pad -- seed-db
  npm run pad -- snapshot
  npm run pad -- update
  npm run pad -- compose up --build
`);
}

const cmd = process.argv[2] ?? "";
const forwarded = process.argv.slice(3);

if (
  cmd === "help" ||
  cmd === "--help" ||
  cmd === "-h" ||
  cmd === ""
) {
  printHelp();
  process.exit(0);
}

loadEnvFile();

switch (cmd) {
  case "build":
    npmBuild();
    break;

  case "seed-db":
  case "seed":
    run(process.execPath, [path.join(root, "scripts", "download-seed-db.mjs")]);
    break;

  case "import-vanish-db":
    run(process.execPath, [
      path.join(root, "scripts", "import-gamewith-vanish-db.mjs"),
      ...forwarded,
    ]);
    break;

  case "generate-vanish-map":
    run(process.execPath, [
      path.join(root, "scripts", "generate-vanish-awoken-name-map.mjs"),
      ...forwarded,
    ]);
    break;

  case "dungeon:gimmick-master":
    run(process.execPath, [
      path.join(root, "dungeon-details", "scripts", "build-gimmick-master.mjs"),
      ...forwarded,
    ]);
    break;

  case "dungeon:import":
    run(process.execPath, [
      path.join(root, "dungeon-details", "scripts", "import-dungeon.mjs"),
      ...forwarded,
    ]);
    break;

  case "snapshot":
    npmBuild();
    runDist("import-external-db.js", { IMPORT_MODE: "download" });
    break;

  case "merge":
    npmBuild();
    runDist("import-external-db.js");
    break;

  case "transform":
    npmBuild();
    runDist("main.js", { START_HTTP: "false", RUN_TRANSFORM: "true" });
    break;

  case "serve":
    npmBuild();
    runDist("main.js", { START_HTTP: "true" });
    break;

  case "update":
    npmBuild();
    runDist("import-external-db.js");
    runDist("main.js", { START_HTTP: "false", RUN_TRANSFORM: "true" });
    break;

  case "compose":
    if (!forwarded.length) {
      console.error(
        "Missing args: npm run pad -- compose up [--build|-d …]"
      );
      process.exit(1);
    }
    run("docker", ["compose", ...forwarded]);
    break;

  default:
    console.error(`Unknown command: ${cmd}\n`);
    printHelp();
    process.exit(1);
}
