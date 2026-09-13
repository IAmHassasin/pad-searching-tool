import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { AdminJobLock } from "./admin-job-lock";
import { deleteJsonSeed, isSafeSeedId } from "./catalog-delete.ts";
import { rethrowIfReadonlyFs } from "./catalog-fs.ts";
import { fetchCatalogText } from "./catalog-fetch";
import { syncNewEvents } from "./event-catalog-sync.ts";
import type { EventSeedFile, MonsterNameRow } from "./event-seed-merge.ts";

const NEWS_URL = "https://www.puzzleanddragons.us/news";

@Injectable()
export class EventCatalogSyncService {
  private readonly logger = new Logger(EventCatalogSyncService.name);
  private readonly seedDir: string;

  constructor(
    private readonly jobs: AdminJobLock,
    @InjectDataSource() private readonly dataSource: DataSource
  ) {
    const seedRoot =
      process.env.EVENT_SEED_ROOT?.trim() || join(process.cwd(), "event/seed");
    this.seedDir = process.env.EVENT_SEED_DIR?.trim() || join(seedRoot, "events");
  }

  async refreshEvents(): Promise<{
    ok: true;
    finishedAt: string;
    created: string[];
    skippedExisting: string[];
    unparsedArticles: number;
  }> {
    this.jobs.begin("Catalog refresh");
    const started = Date.now();
    this.logger.warn("Admin event catalog sync started");
    try {
      const result = await syncNewEvents({
        fetchNewsHtml: () => fetchCatalogText(NEWS_URL),
        fetchArticleHtml: (url) => fetchCatalogText(url),
        listEvents: () => this.listIdentities(),
        loadSeed: (id) => this.loadSeed(id),
        saveSeed: (seed) => this.saveSeed(seed),
        catalog: await this.loadCatalog(),
        groups: await this.loadGroups(),
      });
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      this.logger.warn(
        `Admin event catalog sync finished in ${elapsed}s — created ${result.created.length}, skipped ${result.skippedExisting.length}`
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

  deleteEvent(eventId: string): { ok: true; deleted: string } {
    if (!isSafeSeedId(eventId)) {
      throw new BadRequestException(`Invalid catalog id: ${eventId}`);
    }
    this.jobs.begin("Catalog refresh");
    try {
      const deleted = deleteJsonSeed(this.seedDir, eventId);
      if (!deleted) {
        throw new NotFoundException(`Event ${eventId} not found`);
      }
      return { ok: true, deleted: eventId };
    } finally {
      this.jobs.end();
    }
  }

  private async loadGroups(): Promise<
    Array<{ groupId: number; groupName: string | null }>
  > {
    try {
      return (await this.dataSource.query(
        `SELECT m.group_id AS groupId, (
           SELECT s.name_en
           FROM series s
           JOIN monster_series ms ON ms.series_id = s.series_id
           JOIN monsters mm ON mm.monster_id = ms.monster_id
           WHERE mm.group_id = m.group_id
           ORDER BY CASE WHEN s.series_type = 'collab' THEN 0 ELSE 1 END, ms.priority
           LIMIT 1
         ) AS groupName
         FROM monsters m
         WHERE m.group_id IS NOT NULL AND m.group_id != 0
         GROUP BY m.group_id`
      )) as Array<{ groupId: number; groupName: string | null }>;
    } catch {
      return [];
    }
  }

  private async loadCatalog(): Promise<MonsterNameRow[]> {
    try {
      const rows = (await this.dataSource.query(
        `SELECT monster_id AS monsterId, name_en AS nameEn
         FROM monsters
         WHERE name_en IS NOT NULL AND TRIM(name_en) != ''`
      )) as MonsterNameRow[];
      return rows;
    } catch {
      return [];
    }
  }

  private listIdentities(): Array<{ eventId: string; title: string }> {
    if (!existsSync(this.seedDir)) return [];
    return readdirSync(this.seedDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => {
        const data = JSON.parse(
          readFileSync(join(this.seedDir, name), "utf8")
        ) as EventSeedFile;
        return { eventId: data.eventId, title: data.title };
      });
  }

  private loadSeed(eventId: string): EventSeedFile | null {
    const filePath = join(this.seedDir, `${eventId}.json`);
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf8")) as EventSeedFile;
  }

  private saveSeed(seed: EventSeedFile): void {
    mkdirSync(this.seedDir, { recursive: true });
    const filePath = join(this.seedDir, `${seed.eventId}.json`);
    try {
      writeFileSync(filePath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
    } catch (err) {
      rethrowIfReadonlyFs(err, filePath);
    }
  }
}
