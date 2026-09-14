import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { execFile } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { AdminJobLock } from "./admin-job-lock";
import { rethrowIfReadonlyFs } from "./catalog-fs.ts";
import { fetchCatalogText } from "./catalog-fetch";
import {
  parseDungeonUrlListIds,
} from "./dungeon-catalog-parse.ts";
import { syncNewDungeons } from "./dungeon-catalog-sync.ts";
import { deleteJsonSeed } from "./catalog-delete.ts";

const execFileAsync = promisify(execFile);

const APPMEDIA_HOME = "https://appmedia.jp/pazudora";

@Injectable()
export class DungeonCatalogSyncService {
  private readonly logger = new Logger(DungeonCatalogSyncService.name);
  private readonly seedDir: string;
  private readonly urlsPath: string;
  private readonly importScript: string;

  constructor(private readonly jobs: AdminJobLock) {
    const seedRoot =
      process.env.DUNGEON_DETAILS_SEED_ROOT?.trim() ||
      join(process.cwd(), "dungeon-details/seed");
    this.seedDir =
      process.env.DUNGEON_DETAILS_SEED_DIR?.trim() || join(seedRoot, "dungeons");
    this.urlsPath = join(seedRoot, "dungeon-urls.txt");
    this.importScript = join(
      process.cwd(),
      "dungeon-details/scripts/import-dungeon.mjs"
    );
  }

  async refreshDungeons(): Promise<{
    ok: true;
    finishedAt: string;
    added: number[];
    failed: Array<{ id: number; error: string }>;
    candidateCount: number;
  }> {
    this.jobs.begin("Catalog refresh");
    const started = Date.now();
    this.logger.warn("Admin dungeon catalog sync started");
    try {
      const existingIds = this.readExistingIds();
      const result = await syncNewDungeons({
        fetchHomeHtml: () => fetchCatalogText(APPMEDIA_HOME),
        existingIds,
        previouslyImportedIds: this.readUrlListIds(),
        importDungeon: (id) => this.importOne(id),
      });
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      this.logger.warn(
        `Admin dungeon catalog sync finished in ${elapsed}s — added ${result.added.length}`
      );
      return {
        ok: true,
        finishedAt: new Date().toISOString(),
        ...result,
      };
    } finally {
      this.jobs.end();
    }
  }

  deleteDungeon(postId: number): { ok: true; deleted: number } {
    if (!Number.isFinite(postId) || postId <= 0) {
      throw new NotFoundException(`Dungeon ${postId} not found`);
    }
    this.jobs.begin("Catalog refresh");
    try {
      const deleted = deleteJsonSeed(this.seedDir, String(postId));
      if (!deleted) {
        throw new NotFoundException(`Dungeon ${postId} not found`);
      }
      return { ok: true, deleted: postId };
    } finally {
      this.jobs.end();
    }
  }

  private readUrlListIds(): number[] {
    if (!existsSync(this.urlsPath)) return [];
    return parseDungeonUrlListIds(readFileSync(this.urlsPath, "utf8"));
  }

  private readExistingIds(): number[] {
    if (!existsSync(this.seedDir)) return [];
    return readdirSync(this.seedDir)
      .filter((name) => /^\d+\.json$/.test(name))
      .map((name) => Number(name.replace(/\.json$/, "")))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  private async importOne(id: number): Promise<void> {
    mkdirSync(this.seedDir, { recursive: true });
    await execFileAsync(
      process.execPath,
      [this.importScript, String(id), "--out", this.seedDir],
      { cwd: process.cwd(), timeout: 120_000, windowsHide: true }
    );
    this.appendUrlList(id);
  }

  private appendUrlList(id: number): void {
    const url = `https://appmedia.jp/pazudora/${id}`;
    let current = "";
    if (existsSync(this.urlsPath)) {
      current = readFileSync(this.urlsPath, "utf8");
      if (current.includes(String(id))) return;
    }
    const prefix = current.endsWith("\n") || current.length === 0 ? "" : "\n";
    try {
      appendFileSync(this.urlsPath, `${prefix}${url}\n`, "utf8");
    } catch (err) {
      rethrowIfReadonlyFs(err, this.urlsPath);
    }
  }
}
