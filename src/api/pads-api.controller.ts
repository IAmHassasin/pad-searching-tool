import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PadCategorized } from "../entities/pad-categorized.entity";
import { AwokenSkillsService } from "./awoken-skills.service";
import { SourceRowsService } from "./source-rows.service";

@Controller()
export class PadsApiController {
  constructor(
    @InjectRepository(PadCategorized)
    private readonly categorized: Repository<PadCategorized>,
    private readonly sourceRows: SourceRowsService,
    private readonly awokenSkillsService: AwokenSkillsService
  ) {}

  @Get("health")
  health(): { ok: boolean } {
    return { ok: true };
  }

  /**
   * Raw source rows used for categorization (SOURCE_QUERY join or SOURCE_TABLE).
   * Paginated — use limit/offset to scan the full set.
   */
  @Get("source-records")
  async sourceRecords(
    @Query("limit") limitRaw?: string,
    @Query("offset") offsetRaw?: string
  ): Promise<{
    sourceLabel: string;
    mode: "query" | "table";
    limit: number;
    offset: number;
    rows: Record<string, unknown>[];
  }> {
    const limit = Math.min(
      Math.max(Number(limitRaw ?? "500") || 500, 1),
      5000
    );
    const offset = Math.max(Number(offsetRaw ?? "0") || 0, 0);
    return this.sourceRows.loadPage(limit, offset);
  }

  /** Full rows from `awoken_skills` (paginate with limit/offset to read entire table). */
  @Get("awoken-skills")
  async awokenSkills(
    @Query("limit") limitRaw?: string,
    @Query("offset") offsetRaw?: string
  ): Promise<{
    table: string;
    limit: number;
    offset: number;
    rows: Record<string, unknown>[];
  }> {
    const limit = Math.min(
      Math.max(Number(limitRaw ?? "500") || 500, 1),
      5000
    );
    const offset = Math.max(Number(offsetRaw ?? "0") || 0, 0);
    return this.awokenSkillsService.loadPage(limit, offset);
  }

  @Get("pad-categorized")
  async listCategorized(
    @Query("sourceTable") sourceTable?: string,
    @Query("category") category?: string,
    @Query("limit") limitRaw?: string,
    @Query("offset") offsetRaw?: string
  ): Promise<PadCategorized[]> {
    const qb = this.categorized.createQueryBuilder("p");
    if (sourceTable?.trim()) {
      qb.andWhere("p.sourceTable = :st", { st: sourceTable.trim() });
    }
    if (category?.trim()) {
      qb.andWhere("p.category = :cat", { cat: category.trim() });
    }
    const limit = Math.min(Math.max(Number(limitRaw ?? "100") || 100, 1), 1000);
    const offset = Math.max(Number(offsetRaw ?? "0") || 0, 0);
    qb.take(limit).skip(offset).orderBy("p.id", "ASC");
    return qb.getMany();
  }

  @Get("pad-categorized/by-source-row")
  async findBySourceRow(
    @Query("sourceTable") sourceTable: string,
    @Query("sourceRowId", ParseIntPipe) sourceRowId: number
  ): Promise<PadCategorized> {
    if (!sourceTable?.trim()) {
      throw new BadRequestException('Query param "sourceTable" is required');
    }
    const row = await this.categorized.findOne({
      where: {
        sourceTable: sourceTable.trim(),
        sourceRowId,
      },
    });
    if (!row) {
      throw new NotFoundException(
        `No pad_categorized row for source_table=${sourceTable.trim()} source_row_id=${sourceRowId}`
      );
    }
    return row;
  }
}
