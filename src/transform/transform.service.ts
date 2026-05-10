import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { PadCategorized } from "../entities/pad-categorized.entity";
import { categorizePadRow } from "./categorize-row";
import {
  getSourceColumnWhitelistFromEnv,
  projectSourceRows,
} from "./source-row-projection";

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

@Injectable()
export class TransformService {
  private readonly logger = new Logger(TransformService.name);

  constructor(
    @InjectRepository(PadCategorized)
    private readonly categorized: Repository<PadCategorized>,
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  async run(): Promise<void> {
    const sourceQuery = process.env.SOURCE_QUERY?.trim();
    const sourceTableEnv = process.env.SOURCE_TABLE?.trim();
    const sourceTable = sourceTableEnv || "source_query";
    if (!IDENT.test(sourceTable)) {
      throw new Error(
        `Invalid SOURCE_TABLE label: "${sourceTable}". Use letters, digits, underscore only.`
      );
    }

    const idColumn = process.env.SOURCE_ID_COLUMN?.trim();
    let rows: Record<string, unknown>[];
    try {
      if (sourceQuery) {
        rows = await this.loadSourceRowsFromQuery(sourceQuery, idColumn);
      } else {
        if (!sourceTableEnv) {
          throw new Error(
            'Set SOURCE_TABLE to your SQLite table name (letters, digits, underscore). Example: SOURCE_TABLE="pads"'
          );
        }
        await this.assertTableExists(sourceTable);
        rows = await this.loadSourceRows(sourceTable, idColumn);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const dbPath = process.env.SQLITE_PATH ?? "./pad.db";
      if (/no such table/i.test(msg)) {
        throw new Error(
          `${msg} — SQLITE_PATH (${dbPath}) must be a full PAD DB (e.g. dadguide.sqlite), not an empty pad.db.`
        );
      }
      throw e;
    }

    const columnWhitelist = getSourceColumnWhitelistFromEnv();
    rows = projectSourceRows(rows, columnWhitelist);

    await this.dataSource.transaction(async (mgr) => {
      const repo = mgr.getRepository(PadCategorized);
      await repo.delete({ sourceTable });

      const batch: PadCategorized[] = [];
      for (const row of rows) {
        const sourceRowId = this.resolveSourceRowId(row, idColumn);
        const { category, subcategory, summary } = categorizePadRow({
          sourceTable,
          row,
        });

        batch.push(
          repo.create({
            sourceTable,
            sourceRowId,
            category,
            subcategory,
            summaryJson: summary ? JSON.stringify(summary) : null,
          })
        );

        if (batch.length >= Number(process.env.INSERT_BATCH ?? "500")) {
          await repo.save(batch);
          batch.length = 0;
        }
      }
      if (batch.length) {
        await repo.save(batch);
      }
    });

    const total = await this.categorized.count({ where: { sourceTable } });
    this.logger.log(
      `Wrote ${total} rows into pad_categorized for source "${sourceTable}".`
    );
  }

  private async assertTableExists(table: string): Promise<void> {
    const rows = await this.dataSource.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [table]
    );
    if (!rows.length) {
      const dbPath = process.env.SQLITE_PATH ?? "./pad.db";
      throw new Error(
        `Source table not found: ${table}. ` +
          `Check SQLITE_PATH (${dbPath}) — use a full community DB (e.g. dadguide.sqlite), not an empty or schema-only file.`
      );
    }
  }

  /**
   * Loads every row from SOURCE_TABLE. Uses ROWID as __rowid when SOURCE_ID_COLUMN is unset.
   */
  private async loadSourceRows(
    table: string,
    idColumn?: string
  ): Promise<Record<string, unknown>[]> {
    if (idColumn && !IDENT.test(idColumn)) {
      throw new Error(`Invalid SOURCE_ID_COLUMN: ${idColumn}`);
    }

    const quoted = `"${table.replace(/"/g, '""')}"`;
    const rowIdSelect = idColumn
      ? `"${idColumn.replace(/"/g, '""')}" AS __source_pk`
      : `rowid AS __rowid`;

    const sql = `SELECT ${rowIdSelect}, * FROM ${quoted}`;
    const raw = await this.dataSource.query(sql);

    return raw.map((r: Record<string, unknown>) => {
      const copy = { ...r };
      if (!idColumn && copy.__rowid != null) {
        copy.__rowid = Number(copy.__rowid);
      }
      return copy;
    });
  }

  /**
   * Loads rows from SOURCE_QUERY without creating any table/view in SQLite.
   * SOURCE_ID_COLUMN is required in this mode.
   */
  private async loadSourceRowsFromQuery(
    query: string,
    idColumn?: string
  ): Promise<Record<string, unknown>[]> {
    if (!idColumn || !IDENT.test(idColumn)) {
      throw new Error(
        "When SOURCE_QUERY is set, SOURCE_ID_COLUMN must be set to a valid numeric id column in the query result."
      );
    }

    const idSelect = `"${idColumn.replace(/"/g, '""')}" AS __source_pk`;
    const sql = `SELECT ${idSelect}, q.* FROM (${query}) AS q`;
    return this.dataSource.query(sql);
  }

  private resolveSourceRowId(
    row: Record<string, unknown>,
    idColumn?: string
  ): number {
    if (idColumn) {
      const v = row["__source_pk"] ?? row[idColumn];
      if (v === null || v === undefined || v === "") {
        throw new Error(
          `SOURCE_ID_COLUMN "${idColumn}" is null or missing for a row. Use a non-null key (e.g. monster_id on dadguide "monsters"; monster_no_na is often NULL for many rows).`
        );
      }
      const n = Number(v);
      if (!Number.isFinite(n)) {
        throw new Error(
          `SOURCE_ID_COLUMN "${idColumn}" is not numeric for row: ${JSON.stringify(row)}`
        );
      }
      return n;
    }
    const rid = row.__rowid;
    const n = Number(rid);
    if (!Number.isFinite(n)) {
      throw new Error(
        "Could not resolve row id; set SOURCE_ID_COLUMN to an INTEGER PRIMARY KEY column."
      );
    }
    return n;
  }
}
