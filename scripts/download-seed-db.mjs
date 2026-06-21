#!/usr/bin/env node
/**
 * Download community SQLite → seed/dadguide.sqlite (local bind-mount seed).
 * URL: DB_DOWNLOAD_URL, else COMMUNITY_DB_URL / EXTERNAL_DB_URL from .env
 */

import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const SQLITE_HEADER = Buffer.from("SQLite format 3\0", "utf8");

function loadEnvFile() {
  if (!existsSync(envPath)) {
    console.error(`Missing .env — copy .env.example to .env`);
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

function resolveUrl() {
  const u =
    process.env.DB_DOWNLOAD_URL?.trim() ||
    process.env.COMMUNITY_DB_URL?.trim() ||
    process.env.EXTERNAL_DB_URL?.trim();
  if (!u) {
    console.error(
      "Set DB_DOWNLOAD_URL (or COMMUNITY_DB_URL) in .env to the community .sqlite URL."
    );
    process.exit(1);
  }
  return u;
}

function resolveDest() {
  const raw =
    process.env.SEED_DB_PATH?.trim() ||
    process.env.SQLITE_SNAPSHOT_PATH?.trim() ||
    "./seed/dadguide.sqlite";
  return path.isAbsolute(raw) ? raw : path.join(root, raw);
}

async function downloadToFile(url, dest) {
  console.log(`Downloading ${url}`);
  console.log(`         → ${dest}`);

  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "pad-searching-tool/download-seed-db" },
  });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  const dir = path.dirname(dest);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const tmp = `${dest}.download`;
  const nodeStream = Readable.fromWeb(res.body);
  await pipeline(nodeStream, createWriteStream(tmp));

  const head = readFileSync(tmp).subarray(0, 16);
  if (head.length < 16 || !head.equals(SQLITE_HEADER)) {
    throw new Error(`Downloaded file is not SQLite (bad header): ${tmp}`);
  }

  renameSync(tmp, dest);

  const mb = (statSync(dest).size / (1024 * 1024)).toFixed(1);
  console.log(`Done (${mb} MB): ${dest}`);
}

loadEnvFile();
const url = resolveUrl();
const dest = resolveDest();

if (process.env.DB_DOWNLOAD_URL?.trim()) {
  console.log("Using DB_DOWNLOAD_URL");
} else {
  console.log("DB_DOWNLOAD_URL unset — using COMMUNITY_DB_URL / EXTERNAL_DB_URL");
}

await downloadToFile(url, dest);
