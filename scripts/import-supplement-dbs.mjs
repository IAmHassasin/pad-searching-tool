#!/usr/bin/env node
/**
 * Refresh all PST supplement SQLite databases in one run.
 *
 * Usage:
 *   node scripts/import-supplement-dbs.mjs
 *   node scripts/import-supplement-dbs.mjs --only vanish,void-super-gravity
 *
 * Loads project `.env` when present (same keys as individual import scripts).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

function loadEnvFile() {
  if (!existsSync(envPath)) return;
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

const SUPPLEMENTS = [
  {
    id: "vanish",
    label: "GameWith vanish awoken grants",
    script: "import-gamewith-vanish-db.mjs",
  },
  {
    id: "void-super-gravity",
    label: "Void super gravity (curated list)",
    script: "import-void-super-gravity-db.mjs",
  },
];

function parseOnlyArg(argv) {
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--only" && argv[i + 1]) {
      return argv[++i]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return null;
}

function runScript(scriptName, forwardedArgs) {
  const scriptPath = resolve(root, "scripts", scriptName);
  const r = spawnSync(process.execPath, [scriptPath, ...forwardedArgs], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  const code = typeof r.status === "number" ? r.status : 1;
  if (code !== 0) {
    throw new Error(`${scriptName} exited with code ${code}`);
  }
}

function main() {
  loadEnvFile();
  const only = parseOnlyArg(process.argv);
  const forwarded = process.argv.slice(2).filter((a, i, arr) => {
    if (a === "--only") return false;
    if (i > 0 && arr[i - 1] === "--only") return false;
    return true;
  });

  const selected = SUPPLEMENTS.filter(
    (s) => !only?.length || only.includes(s.id)
  );
  if (!selected.length) {
    const ids = SUPPLEMENTS.map((s) => s.id).join(", ");
    throw new Error(`No supplements matched --only (available: ${ids})`);
  }

  console.log(`Refreshing ${selected.length} supplement DB(s)…\n`);
  for (const [index, supplement] of selected.entries()) {
    console.log(
      `[${index + 1}/${selected.length}] ${supplement.label} (${supplement.id})`
    );
    runScript(supplement.script, forwarded);
    console.log("");
  }
  console.log("All supplement DB imports finished.");
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
