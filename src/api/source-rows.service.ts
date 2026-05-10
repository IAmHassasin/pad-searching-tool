/**
 * Reads arbitrary source rows via TypeORM DataSource (same SQLite connection as AppModule).
 * Raw SQL is used because SOURCE_QUERY is user-defined; mapping that to a typed Entity would be misleading.
 */
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  getSourceColumnWhitelistFromEnv,
  projectSourceRows,
} from "../transform/source-row-projection";

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

@Injectable()
export class SourceRowsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Same row shape as transform uses: SOURCE_QUERY subselect + __source_pk / __rowid, or table scan.
   */
  async loadPage(
    limit: number,
    offset: number
  ): Promise<{
    sourceLabel: string;
    mode: "query" | "table";
    limit: number;
    offset: number;
    rows: Record<string, unknown>[];
  }> {
    const sourceQuery = process.env.SOURCE_QUERY?.trim();
    const sourceTableEnv = process.env.SOURCE_TABLE?.trim();
    const sourceLabel = sourceTableEnv || "source_query";
    const idColumn = process.env.SOURCE_ID_COLUMN?.trim();

    if (!IDENT.test(sourceLabel)) {
      throw new BadRequestException(
        `Invalid SOURCE_TABLE label: "${sourceLabel}". Use letters, digits, underscore only.`
      );
    }

    if (sourceQuery) {
      if (!idColumn || !IDENT.test(idColumn)) {
        throw new BadRequestException(
          "SOURCE_ID_COLUMN must be set to a valid column name when SOURCE_QUERY is set."
        );
      }
      const idSelect = `"${idColumn.replace(/"/g, '""')}" AS __source_pk`;
      const inner = `SELECT ${idSelect}, q.* FROM (${sourceQuery}) AS q`;
      const sql = `SELECT * FROM (${inner}) AS _src LIMIT ? OFFSET ?`;
      let rows = await this.dataSource.query(sql, [limit, offset]);
      rows = projectSourceRows(rows, getSourceColumnWhitelistFromEnv());
      return {
        sourceLabel,
        mode: "query",
        limit,
        offset,
        rows,
      };
    }

    if (!sourceTableEnv) {
      throw new ServiceUnavailableException(
        "SOURCE_TABLE is not set (and SOURCE_QUERY is empty)."
      );
    }
    if (!IDENT.test(sourceTableEnv)) {
      throw new BadRequestException(
        `Invalid SOURCE_TABLE for SQLite: "${sourceTableEnv}".`
      );
    }

    await this.assertTableExists(sourceTableEnv);

    const quoted = `"${sourceTableEnv.replace(/"/g, '""')}"`;
    const rowIdSelect = idColumn
      ? `"${idColumn.replace(/"/g, '""')}" AS __source_pk`
      : `rowid AS __rowid`;
    const sql = `SELECT ${rowIdSelect}, * FROM ${quoted} LIMIT ? OFFSET ?`;
    let rows = await this.dataSource.query(sql, [limit, offset]);
    rows = projectSourceRows(rows, getSourceColumnWhitelistFromEnv());

    return {
      sourceLabel,
      mode: "table",
      limit,
      offset,
      rows,
    };
  }

  private async assertTableExists(table: string): Promise<void> {
    const rows = await this.dataSource.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [table]
    );
    if (!rows.length) {
      throw new BadRequestException(`Source table not found: ${table}`);
    }
  }
}
