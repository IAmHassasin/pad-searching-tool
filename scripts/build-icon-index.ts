/**
 * Builds `web/public/team-build/icon-index.bin`: one card descriptor per monster icon, used by
 * the team-build "Import from screenshot" matcher (see web/src/lib/team-build/screenshot).
 *
 * Incremental: ids already in the index are not fetched again, ids no longer in the DB are
 * dropped, and downloaded PNGs are cached under `tmp/icon-cache` (gitignored).
 *
 * Usage:
 *   npm run icon-index            # reads .env (VITE_PAD_CDN_ORIGIN, SQLITE_PATH)
 *   npm run icon-index -- --full  # recompute every descriptor
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pngjs from "pngjs";
import {
  CARD_DESCRIPTOR_LENGTH,
  cardDescriptor,
  grayThumbnail,
} from "../web/src/lib/team-build/screenshot/descriptor.ts";
import {
  encodeIconIndex,
  indexDescriptor,
  parseIconIndex,
  type IconIndexEntry,
} from "../web/src/lib/team-build/screenshot/icon-index.ts";

const { PNG } = pngjs;

const cdnOrigin = (process.env.VITE_PAD_CDN_ORIGIN ?? "").trim().replace(/\/$/, "");
const sqlitePath = process.env.SQLITE_PATH?.trim() || "seed/dadguide.sqlite";
const outPath =
  process.env.ICON_INDEX_PATH?.trim() || "web/public/team-build/icon-index.bin";
const cacheDir = process.env.ICON_CACHE_DIR?.trim() || "tmp/icon-cache";
const concurrency = Math.max(
  1,
  Number(process.env.ICON_INDEX_CONCURRENCY ?? 16) || 16
);
const full = process.argv.includes("--full");

function iconFileName(id: number): string {
  return `${String(id).padStart(5, "0")}.png`;
}

/** PNG bytes from the local cache or the CDN; null when the CDN has no icon for the id. */
async function loadIconPng(id: number): Promise<Buffer | null> {
  const cached = path.join(cacheDir, iconFileName(id));
  if (existsSync(cached)) return readFile(cached);
  const res = await fetch(`${cdnOrigin}/icons/${iconFileName(id)}`);
  // The CDN answers 403 (S3 origin) or 404 for ids it has no icon for.
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} while fetching icon ${id}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(cached, buf);
  return buf;
}

function descriptorFromPng(buf: Buffer): Uint8Array {
  const png = PNG.sync.read(buf);
  const thumb = grayThumbnail(
    { width: png.width, height: png.height, data: png.data },
    { x: 0, y: 0, w: png.width, h: png.height }
  );
  return Uint8Array.from(cardDescriptor(thumb));
}

async function main(): Promise<void> {
  if (!cdnOrigin) {
    throw new Error(
      "VITE_PAD_CDN_ORIGIN is not set (run through `dotenv -e .env`, see npm run icon-index)."
    );
  }
  const db = new Database(sqlitePath, { readonly: true });
  const ids = (
    db
      .prepare("SELECT monster_id FROM monsters WHERE monster_id > 1 ORDER BY monster_id")
      .all() as { monster_id: number }[]
  ).map((r) => r.monster_id);
  db.close();

  const entries = new Map<number, Uint8Array>();
  if (!full && existsSync(outPath)) {
    const existing = parseIconIndex(await readFile(outPath));
    if (existing.length === CARD_DESCRIPTOR_LENGTH) {
      for (let i = 0; i < existing.count; i++) {
        entries.set(existing.ids[i], Uint8Array.from(indexDescriptor(existing, i)));
      }
    }
  }
  const idSet = new Set(ids);
  for (const id of [...entries.keys()]) if (!idSet.has(id)) entries.delete(id);
  const todo = ids.filter((id) => !entries.has(id));
  console.log(
    `DB ids: ${ids.length}; already indexed: ${entries.size}; to fetch: ${todo.length}`
  );

  await mkdir(cacheDir, { recursive: true });
  const missing: number[] = [];
  let done = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < todo.length) {
      const id = todo[cursor++];
      const buf = await loadIconPng(id);
      if (buf) entries.set(id, descriptorFromPng(buf));
      else missing.push(id);
      done++;
      if (done % 500 === 0) console.log(`  ${done}/${todo.length}`);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, todo.length) }, worker)
  );

  const list: IconIndexEntry[] = [...entries].map(([id, descriptor]) => ({
    id,
    descriptor,
  }));
  await mkdir(path.dirname(outPath), { recursive: true });
  const bytes = encodeIconIndex(list);
  await writeFile(outPath, bytes);
  const missingNote = missing.length
    ? ` (${missing.slice(0, 20).join(", ")}${missing.length > 20 ? ", …" : ""})`
    : "";
  console.log(
    `Wrote ${outPath}: ${list.length} icons, ${(bytes.length / 1024 / 1024).toFixed(2)} MB; ` +
      `missing on CDN: ${missing.length}${missingNote}`
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
