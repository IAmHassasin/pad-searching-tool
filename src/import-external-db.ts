/**
 * Download community PAD SQLite and merge into the working DB (see pad-fansite-architecture.md §5).
 * Preserves local-only / derived tables by default (pad_categorized, skill_tag, …).
 */
import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { randomBytes } from "crypto";
import { tmpdir } from "os";

const SQLITE_HEADER = Buffer.from("SQLite format 3\0", "utf8");

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function parseList(raw: string | undefined): Set<string> {
  const s = new Set<string>();
  if (!raw) return s;
  for (const part of raw.split(",")) {
    const t = part.trim().toLowerCase();
    if (t) s.add(t);
  }
  return s;
}

function resolveDownloadUrl(): string {
  const u =
    process.env.COMMUNITY_DB_URL?.trim() ||
    process.env.EXTERNAL_DB_URL?.trim() ||
    process.env.DB_DOWNLOAD_URL?.trim();
  if (!u) {
    throw new Error(
      "Set COMMUNITY_DB_URL, EXTERNAL_DB_URL, or DB_DOWNLOAD_URL to the community SQLite file (https)."
    );
  }
  return u;
}

function defaultKeepLocal(): Set<string> {
  return parseList(
    process.env.IMPORT_KEEP_LOCAL_TABLES ??
      "pad_categorized,skill_tag,skill_tag_manual"
  );
}

function parseSkip(): Set<string> {
  return parseList(process.env.IMPORT_SKIP_TABLES);
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "pad-searching-tool/import-external-db" },
  });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${res.status} ${res.statusText} (${url})`);
  }
  const body = res.body;
  const nodeStream = Readable.fromWeb(body as import("stream/web").ReadableStream);
  await pipeline(nodeStream, createWriteStream(dest));
}

function assertSqliteFile(path: string): void {
  const buf = readFileSync(path);
  const head = buf.subarray(0, 16);
  if (head.length < 16 || !head.equals(SQLITE_HEADER)) {
    throw new Error(
      `File does not look like SQLite (bad header). Path: ${path}`
    );
  }
}

function backupIfNeeded(sqlitePath: string): void {
  if (process.env.IMPORT_BACKUP !== "true" || !existsSync(sqlitePath)) return;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const bak = `${sqlitePath}.bak-${ts}`;
  copyFileSync(sqlitePath, bak);
  console.log(`Backed up current DB to ${bak}`);
}

function mergeStagingIntoMain(
  sqlitePath: string,
  stagingPath: string,
  keepLocal: Set<string>,
  skipFromExt: Set<string>
): void {
  const dir = dirname(sqlitePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const main = new Database(sqlitePath);
  try {
    main.pragma("foreign_keys = OFF");
    main.prepare("ATTACH ? AS ext").run(stagingPath);
    try {
      const extTables = main
        .prepare(
          `SELECT name FROM ext.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
        )
        .all() as { name: string }[];

      const copy = main.transaction(() => {
        for (const { name } of extTables) {
          const lower = name.toLowerCase();
          if (skipFromExt.has(lower)) {
            console.log(`Skip (IMPORT_SKIP_TABLES): ${name}`);
            continue;
          }
          if (keepLocal.has(lower)) {
            console.log(
              `Skip community import for local/derived name (IMPORT_KEEP_LOCAL_TABLES): ${name}`
            );
            continue;
          }

          const inMain = main
            .prepare(
              `SELECT 1 FROM main.sqlite_master WHERE type = 'table' AND name = ?`
            )
            .get(name);

          if (inMain) {
            main.exec(`DELETE FROM main.${quoteIdent(name)}`);
            main.exec(
              `INSERT INTO main.${quoteIdent(name)} SELECT * FROM ext.${quoteIdent(name)}`
            );
            console.log(`Replaced rows from community dump: ${name}`);
          } else {
            const row = main
              .prepare(
                `SELECT sql FROM ext.sqlite_master WHERE type = 'table' AND name = ?`
              )
              .get(name) as { sql: string } | undefined;
            if (!row?.sql) {
              throw new Error(`Missing CREATE statement for table ${name}`);
            }
            main.exec(row.sql);
            main.exec(
              `INSERT INTO main.${quoteIdent(name)} SELECT * FROM ext.${quoteIdent(name)}`
            );
            console.log(`Created table and imported from community dump: ${name}`);
          }
        }
      });

      copy();
    } finally {
      main.prepare("DETACH DATABASE ext").run();
    }
  } finally {
    main.close();
  }
}

function replaceFile(sqlitePath: string, stagingPath: string): void {
  const dir = dirname(sqlitePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  copyFileSync(stagingPath, sqlitePath);
  console.log(`Replaced working DB with downloaded file: ${sqlitePath}`);
}

async function main(): Promise<void> {
  const url = resolveDownloadUrl();
  const sqlitePath = process.env.SQLITE_PATH ?? "./pad.db";
  const mode = (process.env.IMPORT_MODE ?? "merge").toLowerCase();

  const staging = join(
    tmpdir(),
    `pad-community-${randomBytes(8).toString("hex")}.sqlite`
  );

  console.log(`Downloading community database…`);
  await downloadToFile(url, staging);
  assertSqliteFile(staging);
  console.log(`Download OK → ${staging}`);

  if (mode === "download") {
    const snap =
      process.env.SNAPSHOT_OUTPUT_PATH?.trim() ||
      process.env.SQLITE_SNAPSHOT_PATH?.trim();
    if (!snap) {
      throw new Error(
        "IMPORT_MODE=download requires SNAPSHOT_OUTPUT_PATH (or SQLITE_SNAPSHOT_PATH) — the immutable local/cloud path for the SQLite file."
      );
    }
    const dir = dirname(snap);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    backupIfNeeded(snap);
    replaceFile(snap, staging);
    unlinkSync(staging);
    console.log(
      `Saved immutable snapshot only (no merge into working DB): ${snap}`
    );
    console.log(
      "Docker: mount this read-only as SQLITE_SNAPSHOT_PATH, or copy it to object storage."
    );
    return;
  }

  const keepLocal = defaultKeepLocal();
  const skipFromExt = parseSkip();

  if (mode === "replace") {
    backupIfNeeded(sqlitePath);
    replaceFile(sqlitePath, staging);
  } else if (mode === "merge") {
    backupIfNeeded(sqlitePath);
    mergeStagingIntoMain(sqlitePath, staging, keepLocal, skipFromExt);
  } else {
    throw new Error(
      `Invalid IMPORT_MODE="${mode}" (use merge, replace, or download)`
    );
  }

  unlinkSync(staging);
  console.log(`Import finished. Working DB: ${sqlitePath}`);
  console.log(
    `Next (architecture doc §5): run the tagging/transform pipeline, e.g. npm run transform`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
