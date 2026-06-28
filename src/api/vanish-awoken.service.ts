import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { DataSource } from "typeorm";

const ATTACH_ALIAS = "vanish_awoken_db";

export type VanishSearchFilters = {
  vanishOnly?: boolean;
  vanishAwakeningIds?: number[];
  vanishAwakeningMatch?: "any" | "all";
  excludedVanishAwakeningIds?: number[];
};

@Injectable()
export class VanishAwokenService implements OnModuleDestroy {
  private readonly logger = new Logger(VanishAwokenService.name);
  private attachedPath: string | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleDestroy(): void {
    void this.detachIfNeeded();
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
    return this.resolveDbPath() != null;
  }

  async ensureAttached(): Promise<boolean> {
    const path = this.resolveDbPath();
    if (!path) return false;

    if (this.attachedPath === path) return true;

    await this.detachIfNeeded();
    const escaped = path.replace(/'/g, "''");
    try {
      await this.dataSource.query(
        `ATTACH DATABASE '${escaped}' AS ${ATTACH_ALIAS}`
      );
    } catch (err) {
      this.logger.warn(
        `Could not attach vanish awoken DB at ${path}: ${err instanceof Error ? err.message : err}`
      );
      return false;
    }
    this.attachedPath = path;
    return true;
  }

  private async detachIfNeeded(): Promise<void> {
    if (!this.attachedPath) return;
    try {
      await this.dataSource.query(`DETACH DATABASE ${ATTACH_ALIAS}`);
    } catch {
      // already detached
    }
    this.attachedPath = null;
  }

  monsterIdExpr(): string {
    return `CAST(COALESCE(_src."monster_id", _src.__source_pk) AS INTEGER)`;
  }

  joinSql(): string {
    return (
      `LEFT JOIN ${ATTACH_ALIAS}.monster_vanish_awoken AS _vanish ` +
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
