import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DataSource } from "typeorm";
import {
  buildAwokenNameIndex,
  buildVanishRows,
  fetchGameWithVanishMaster,
  pruneVanishDelta,
  syncVanishDeltaRows,
  vanishReadSourceSql,
  vanishTableDdl,
  VANISH_TABLE_NAME,
  type SqlExec,
  type VanishDeltaSyncResult,
} from "../vanish/gamewith-vanish-sync";
import {
  detachSupplementDb,
  ensureSupplementDbAttached,
  type SupplementAttachCache,
} from "./supplement-db-attach";

const ATTACH_ALIAS = "vanish_awoken_db";
const DELTA_ATTACH_ALIAS = "vanish_awoken_delta_db";
const TABLE_NAME = VANISH_TABLE_NAME;

export type VanishDeltaRefreshReport = VanishDeltaSyncResult & {
  deltaPath: string;
  skipped: number;
  unmappedNames: string[];
};

export type VanishSearchFilters = {
  vanishOnly?: boolean;
  vanishAwakeningIds?: number[];
  vanishAwakeningMatch?: "any" | "all";
  excludedVanishAwakeningIds?: number[];
};

@Injectable()
export class VanishAwokenService implements OnModuleDestroy {
  private readonly logger = new Logger(VanishAwokenService.name);
  private readonly cache: SupplementAttachCache = { attachedPath: null };
  private readonly deltaCache: SupplementAttachCache = { attachedPath: null };
  private baseAttached = false;
  private deltaAttached = false;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleDestroy(): void {
    void detachSupplementDb(this.dataSource, ATTACH_ALIAS, this.cache);
    void detachSupplementDb(this.dataSource, DELTA_ATTACH_ALIAS, this.deltaCache);
  }

  /**
   * Delta DB written by the admin refresh for assists missing from the base DB.
   * Lives next to the working DB (DATA_DIR volume in Docker) so it survives restarts.
   */
  resolveDeltaPath(): string {
    const explicit = process.env.VANISH_AWOKEN_DELTA_SQLITE_PATH?.trim();
    if (explicit) return resolve(explicit);
    const dataDir = process.env.DATA_DIR?.trim();
    if (dataDir) return resolve(join(dataDir, "gamewith-vanish-delta.sqlite"));
    return resolve(process.cwd(), "seed/gamewith-vanish-delta.sqlite");
  }

  private existingDeltaPath(): string | null {
    const path = this.resolveDeltaPath();
    try {
      return existsSync(path) && statSync(path).isFile() ? path : null;
    } catch {
      return null;
    }
  }

  resolveDbPath(): string | null {
    const raw =
      process.env.VANISH_AWOKEN_SQLITE_PATH?.trim() ||
      resolve(process.cwd(), "seed/gamewith-vanish.sqlite");
    try {
      if (!existsSync(raw)) return null;
      if (!statSync(raw).isFile()) {
        this.logger.warn(
          `VANISH_AWOKEN_SQLITE_PATH is not a file (bind-mount missing?): ${raw}`
        );
        return null;
      }
      return raw;
    } catch {
      return null;
    }
  }

  isAvailable(): boolean {
    return this.resolveDbPath() != null || this.existingDeltaPath() != null;
  }

  resetAttachment(): void {
    this.cache.attachedPath = null;
    this.deltaCache.attachedPath = null;
    this.baseAttached = false;
    this.deltaAttached = false;
  }

  /** Attaches the base DB and (when present) the delta DB. True if either is usable. */
  async ensureAttached(): Promise<boolean> {
    const path = this.resolveDbPath();
    this.baseAttached = path
      ? await ensureSupplementDbAttached(this.dataSource, {
          alias: ATTACH_ALIAS,
          tableName: TABLE_NAME,
          path,
          cache: this.cache,
          logger: this.logger,
          label: "vanish awoken",
        })
      : false;

    const deltaPath = this.existingDeltaPath();
    if (!deltaPath) {
      this.deltaAttached = false;
      return this.baseAttached;
    }
    const previousDeltaPath = this.deltaCache.attachedPath;
    this.deltaAttached = await ensureSupplementDbAttached(this.dataSource, {
      alias: DELTA_ATTACH_ALIAS,
      tableName: TABLE_NAME,
      path: deltaPath,
      cache: this.deltaCache,
      logger: this.logger,
      label: "vanish awoken delta",
    });
    // Base wins: drop delta rows the (possibly redeployed) base now covers.
    if (this.deltaAttached && this.baseAttached && previousDeltaPath !== deltaPath) {
      await this.pruneDeltaQuietly();
    }
    return this.baseAttached || this.deltaAttached;
  }

  private async pruneDeltaQuietly(): Promise<void> {
    try {
      const removed = await pruneVanishDelta(
        this.sqlExec(),
        ATTACH_ALIAS,
        DELTA_ATTACH_ALIAS
      );
      if (removed > 0) {
        this.logger.log(`Pruned ${removed} vanish delta row(s) already in the base DB`);
      }
    } catch (err) {
      // Reads stay correct: joinSql() still prefers base rows over delta rows.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not prune vanish delta DB: ${msg}`);
    }
  }

  private sqlExec(): SqlExec {
    return async (sql, params) =>
      ((await this.dataSource.query(sql, params ?? [])) as unknown[] | undefined) ?? [];
  }

  /**
   * Fetch the latest GameWith assist list and store assists missing from the
   * base DB in the delta DB. Requires the working DB to be initialized
   * (awoken_skills is used for name → id mapping).
   */
  async refreshDeltaFromGameWith(): Promise<VanishDeltaRefreshReport> {
    const deltaPath = this.resolveDeltaPath();
    this.createDeltaDbIfMissing(deltaPath);

    const { assistMonsters, awakenings } = await fetchGameWithVanishMaster();
    const awokenTable = process.env.AWOKEN_SKILLS_TABLE?.trim() || "awoken_skills";
    if (!/^[A-Za-z0-9_]+$/.test(awokenTable)) {
      throw new Error(`Invalid AWOKEN_SKILLS_TABLE: "${awokenTable}"`);
    }
    const awokenRows = (await this.dataSource.query(
      `SELECT awoken_skill_id, name_ja FROM "${awokenTable}"`
    )) as { awoken_skill_id: unknown; name_ja: unknown }[];
    const nameIndex = buildAwokenNameIndex(awokenRows, this.loadManualNameMap());
    const built = buildVanishRows(assistMonsters, awakenings, nameIndex);
    if (!built.rows.length) {
      throw new Error("No vanish-grant rows parsed — GameWith format may have changed.");
    }

    if (!(await this.ensureAttached()) || !this.deltaAttached) {
      throw new Error(`Could not attach vanish delta DB at ${deltaPath}`);
    }
    const result = await syncVanishDeltaRows(this.sqlExec(), {
      baseAlias: this.baseAttached ? ATTACH_ALIAS : null,
      deltaAlias: DELTA_ATTACH_ALIAS,
      rows: built.rows,
    });
    return {
      ...result,
      deltaPath,
      skipped: built.skippedIds.length,
      unmappedNames: built.unmappedNames,
    };
  }

  private createDeltaDbIfMissing(path: string): void {
    mkdirSync(dirname(path), { recursive: true });
    const db = new Database(path);
    try {
      db.exec(vanishTableDdl("main"));
    } finally {
      db.close();
    }
  }

  private loadManualNameMap(): Record<string, unknown> {
    const path =
      process.env.VANISH_AWOKEN_NAME_MAP_PATH?.trim() ||
      resolve(process.cwd(), "seed/vanish-awoken-name-map.json");
    if (!existsSync(path)) {
      this.logger.warn(`Vanish awoken name map not found at ${path}; using DB names only`);
      return {};
    }
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${path} must be a JSON object of name_ja → awoken_skill_id`);
    }
    return parsed as Record<string, unknown>;
  }

  monsterIdExpr(): string {
    return `CAST(COALESCE(_src."monster_id", _src.__source_pk) AS INTEGER)`;
  }

  joinSql(): string {
    const source =
      vanishReadSourceSql(
        this.baseAttached ? ATTACH_ALIAS : null,
        this.deltaAttached ? DELTA_ATTACH_ALIAS : null
      ) ?? `${ATTACH_ALIAS}.${TABLE_NAME}`;
    return (
      `LEFT JOIN ${source} AS _vanish ` +
      `ON _vanish.monster_id = ${this.monsterIdExpr()}`
    );
  }

  selectSql(): string {
    return `_vanish.awoken_skill_ids AS __vanish_awoken_skill_ids`;
  }

  buildVanishWhere(
    filters: VanishSearchFilters | undefined,
    params: unknown[]
  ): string[] {
    if (!filters) return [];
    const clauses: string[] = [];

    if (filters.vanishOnly) {
      clauses.push(`_vanish.monster_id IS NOT NULL`);
    }

    const hasInclude = (filters.vanishAwakeningIds?.length ?? 0) > 0;
    const hasExclude = (filters.excludedVanishAwakeningIds?.length ?? 0) > 0;

    if (hasInclude) {
      if (filters.vanishAwakeningMatch === "all") {
        const required = new Map<number, number>();
        for (const id of filters.vanishAwakeningIds!) {
          required.set(id, (required.get(id) ?? 0) + 1);
        }
        const parts: string[] = [];
        for (const [id, minCount] of required) {
          parts.push(this.vanishCountClause(id, minCount, params));
        }
        clauses.push(`(${parts.join(" AND ")})`);
      } else {
        const unique = [...new Set(filters.vanishAwakeningIds!)];
        const parts = unique.map((id) =>
          this.vanishCountClause(id, 1, params)
        );
        clauses.push(`(${parts.join(" OR ")})`);
      }
    }

    if (hasExclude) {
      const unique = [...new Set(filters.excludedVanishAwakeningIds!)];
      const parts = unique.map(
        (id) => `NOT (${this.vanishCountClause(id, 1, params)})`
      );
      clauses.push(`(${parts.join(" AND ")})`);
    }

    return clauses;
  }

  private vanishCountClause(
    id: number,
    minCount: number,
    params: unknown[]
  ): string {
    params.push(id, minCount);
    return (
      `(SELECT COUNT(*) FROM json_each(COALESCE(_vanish.awoken_skill_ids, '[]')) ` +
      `WHERE CAST(value AS INTEGER) = ?) >= ?`
    );
  }

  enrichRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    return rows.map((row) => {
      const raw = row.__vanish_awoken_skill_ids;
      delete row.__vanish_awoken_skill_ids;
      const ids = parseVanishAwokenIds(raw);
      if (ids.length) {
        row.vanish_granted_awoken_ids = ids;
      }
      return row;
    });
  }
}

export function parseVanishAwokenIds(raw: unknown): number[] {
  if (raw == null || raw === "") return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n));
      }
    } catch {
      return [];
    }
  }
  return [];
}

export function hasVanishFilters(filters: VanishSearchFilters | undefined): boolean {
  if (!filters) return false;
  return (
    Boolean(filters.vanishOnly) ||
    (filters.vanishAwakeningIds?.length ?? 0) > 0 ||
    (filters.excludedVanishAwakeningIds?.length ?? 0) > 0
  );
}
