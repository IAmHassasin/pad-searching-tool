import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

@Injectable()
export class AwokenSkillsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Full table scan of `awoken_skills` (or AWOKEN_SKILLS_TABLE) with pagination.
   */
  async loadPage(
    limit: number,
    offset: number
  ): Promise<{
    table: string;
    limit: number;
    offset: number;
    rows: Record<string, unknown>[];
  }> {
    const table = process.env.AWOKEN_SKILLS_TABLE?.trim() || "awoken_skills";
    if (!IDENT.test(table)) {
      throw new BadRequestException(
        `Invalid AWOKEN_SKILLS_TABLE: "${table}". Use letters, digits, underscore only.`
      );
    }
    await this.assertTableExists(table);
    const quoted = `"${table.replace(/"/g, '""')}"`;
    const sql = `SELECT * FROM ${quoted} ORDER BY rowid ASC LIMIT ? OFFSET ?`;
    const rows = await this.dataSource.query(sql, [limit, offset]);
    return { table, limit, offset, rows };
  }

  private async assertTableExists(table: string): Promise<void> {
    const found = await this.dataSource.query(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
      [table]
    );
    if (!found.length) {
      throw new BadRequestException(`Table not found: ${table}`);
    }
  }
}
