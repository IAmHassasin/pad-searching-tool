import Database from "better-sqlite3";
import { randomBytes } from "crypto";
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const SQLITE_HEADER = Buffer.from("SQLite format 3\0", "utf8");

export type ImportMode = "merge" | "replace" | "download";

export type CommunityImportResult = {
  mode: ImportMode;
  sqlitePath: string;
  downloadUrl: string;
  tablesReplaced: string[];
  tablesSkipped: string[];
  tablesCreated: string[];
};

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function parseImportTableList(raw: string | undefined): Set<string> {
  const s = new Set<string>();
  if (!raw) return s;
  for (const part of raw.split(",")) {
    const t = part.trim().toLowerCase();
    if (t) s.add(t);
  }
  return s;
}

export function resolveCommunityDownloadUrl(): string {
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

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "pad-searching-tool/import-external-db" },
  });
  if (!res.ok || !res.body) {
    throw new Error(
      `Download failed: ${res.status} ${res.statusText} (${url})`
    );
  }
  const nodeStream = Readable.fromWeb(
    res.body as import("stream/web").ReadableStream
  );
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
}

function mergeStagingIntoMain(
  sqlitePath: string,
  stagingPath: string,
  keepLocal: Set<string>,
  skipFromExt: Set<string>
): { replaced: string[]; skipped: string[]; created: string[] } {
  const dir = dirname(sqlitePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const replaced: string[] = [];
  const skipped: string[] = [];
  const created: string[] = [];

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
            skipped.push(name);
            continue;
          }
          if (keepLocal.has(lower)) {
            skipped.push(name);
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
            replaced.push(name);
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
            created.push(name);
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

  return { replaced, skipped, created };
}

function replaceFile(sqlitePath: string, stagingPath: string): void {
  const dir = dirname(sqlitePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  copyFileSync(stagingPath, sqlitePath);
}

export async function runCommunityDbImport(options?: {
  mode?: ImportMode;
  sqlitePath?: string;
}): Promise<CommunityImportResult> {
  const url = resolveCommunityDownloadUrl();
  const sqlitePath = options?.sqlitePath ?? process.env.SQLITE_PATH ?? "./pad.db";
  const mode = (options?.mode ?? process.env.IMPORT_MODE ?? "merge").toLowerCase() as ImportMode;

  if (mode !== "merge" && mode !== "replace" && mode !== "download") {
    throw new Error(
      `Invalid IMPORT_MODE="${mode}" (use merge, replace, or download)`
    );
  }

  const staging = join(
    tmpdir(),
    `pad-community-${randomBytes(8).toString("hex")}.sqlite`
  );

  try {
    await downloadToFile(url, staging);
    assertSqliteFile(staging);

    if (mode === "download") {
      const snap =
        process.env.SNAPSHOT_OUTPUT_PATH?.trim() ||
        process.env.SQLITE_SNAPSHOT_PATH?.trim();
      if (!snap) {
        throw new Error(
          "IMPORT_MODE=download requires SNAPSHOT_OUTPUT_PATH (or SQLITE_SNAPSHOT_PATH)."
        );
      }
      const dir = dirname(snap);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      backupIfNeeded(snap);
      replaceFile(snap, staging);
      return {
        mode,
        sqlitePath: snap,
        downloadUrl: url,
        tablesReplaced: [],
        tablesSkipped: [],
        tablesCreated: [],
      };
    }

    const keepLocal = parseImportTableList(
      process.env.IMPORT_KEEP_LOCAL_TABLES ??
        "pad_categorized,skill_tag,skill_tag_manual"
    );
    const skipFromExt = parseImportTableList(process.env.IMPORT_SKIP_TABLES);

    if (mode === "replace") {
      backupIfNeeded(sqlitePath);
      replaceFile(sqlitePath, staging);
      return {
        mode,
        sqlitePath,
        downloadUrl: url,
        tablesReplaced: ["*"],
        tablesSkipped: [],
        tablesCreated: [],
      };
    }

    backupIfNeeded(sqlitePath);
    const { replaced, skipped, created } = mergeStagingIntoMain(
      sqlitePath,
      staging,
      keepLocal,
      skipFromExt
    );

    return {
      mode,
      sqlitePath,
      downloadUrl: url,
      tablesReplaced: replaced,
      tablesSkipped: skipped,
      tablesCreated: created,
    };
  } finally {
    if (existsSync(staging)) {
      unlinkSync(staging);
    }
  }
}
