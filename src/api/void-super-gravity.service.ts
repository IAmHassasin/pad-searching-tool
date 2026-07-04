import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { DataSource } from "typeorm";
import {
  detachSupplementDb,
  ensureSupplementDbAttached,
  type SupplementAttachCache,
} from "./supplement-db-attach";

const ATTACH_ALIAS = "void_super_gravity_db";
const TABLE_NAME = "monster_void_super_gravity";

@Injectable()
export class VoidSuperGravityService implements OnModuleDestroy {
  private readonly logger = new Logger(VoidSuperGravityService.name);
  private readonly cache: SupplementAttachCache = { attachedPath: null };

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleDestroy(): void {
    void detachSupplementDb(this.dataSource, ATTACH_ALIAS, this.cache);
  }

  resolveDbPath(): string | null {
    const raw =
      process.env.VOID_SUPER_GRAVITY_SQLITE_PATH?.trim() ||
      resolve(process.cwd(), "seed/void-super-gravity.sqlite");
    try {
      if (!existsSync(raw)) return null;
      if (!statSync(raw).isFile()) {
        this.logger.warn(
          `VOID_SUPER_GRAVITY_SQLITE_PATH is not a file (bind-mount missing?): ${raw}`
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

  resetAttachment(): void {
    this.cache.attachedPath = null;
  }

  async ensureAttached(): Promise<boolean> {
    const path = this.resolveDbPath();
    if (!path) return false;
    return ensureSupplementDbAttached(this.dataSource, {
      alias: ATTACH_ALIAS,
      tableName: TABLE_NAME,
      path,
      cache: this.cache,
      logger: this.logger,
      label: "void super gravity",
    });
  }

  monsterIdExpr(): string {
    return `CAST(COALESCE(_src."monster_id", _src.__source_pk) AS INTEGER)`;
  }

  joinSql(): string {
    return (
      `LEFT JOIN ${ATTACH_ALIAS}.${TABLE_NAME} AS _vsg ` +
      `ON _vsg.monster_id = ${this.monsterIdExpr()}`
    );
  }

  selectSql(): string {
    return `_vsg.turns AS __void_super_gravity_turns`;
  }

  enrichRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    return rows.map((row) => {
      const raw = row.__void_super_gravity_turns;
      delete row.__void_super_gravity_turns;
      const turns = parseVoidSuperGravityTurns(raw);
      if (turns != null) {
        row.void_super_gravity_turns = turns;
      }
      return row;
    });
  }
}

export function parseVoidSuperGravityTurns(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
