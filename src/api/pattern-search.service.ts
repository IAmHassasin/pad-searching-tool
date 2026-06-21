import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { PatternCatalogService } from "../patterns/pattern-catalog.service";
import type { PatternTagSelection, SkillType } from "../patterns/pattern-types";
import {
  getSourceColumnWhitelistFromEnv,
  projectSourceRows,
} from "../transform/source-row-projection";

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export type MonsterSearchFilters = {
  rarity?: number[];
  attributes?: number[];
  hpMin?: number | null;
  hpMax?: number | null;
  atkMin?: number | null;
  atkMax?: number | null;
  rcvMin?: number | null;
  rcvMax?: number | null;
  idQuery?: string;
  awakeningIds?: number[];
  awakeningMatch?: "any" | "all";
};

export type PatternSearchInput = {
  activeTags: string[];
  leaderTags: string[];
  patternMatch: "any" | "all";
  activeSkillText?: string;
  leaderSkillText?: string;
  skillTextMode?: "both" | "active" | "leader";
  monster?: MonsterSearchFilters;
  limit: number;
  offset: number;
};

@Injectable()
export class PatternSearchService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly patterns: PatternCatalogService
  ) {}

  private activeDescColumn(): string {
    return (
      process.env.PATTERN_ACTIVE_DESC_COLUMN?.trim() ||
      process.env.FILTER_DESC_COLUMN?.trim() ||
      "active_skill_desc_en"
    );
  }

  private leaderDescColumn(): string {
    return (
      process.env.PATTERN_LEADER_DESC_COLUMN?.trim() ||
      "leader_skill_desc_en"
    );
  }

  private quotedColumn(name: string): string {
    if (!IDENT.test(name)) {
      throw new BadRequestException(`Invalid column name: ${name}`);
    }
    return `"${name.replace(/"/g, '""')}"`;
  }

  private buildSourceSubquery(): {
    sql: string;
    sourceLabel: string;
    mode: "query" | "table";
  } {
    const sourceQuery = process.env.SOURCE_QUERY?.trim();
    const sourceTableEnv = process.env.SOURCE_TABLE?.trim();
    const sourceLabel = sourceTableEnv || "source_query";
    const idColumn = process.env.SOURCE_ID_COLUMN?.trim();

    if (!IDENT.test(sourceLabel)) {
      throw new BadRequestException(
        `Invalid SOURCE_TABLE label: "${sourceLabel}".`
      );
    }

    if (sourceQuery) {
      if (!idColumn || !IDENT.test(idColumn)) {
        throw new BadRequestException(
          "SOURCE_ID_COLUMN must be set when SOURCE_QUERY is configured."
        );
      }
      const idSelect = `"${idColumn.replace(/"/g, '""')}" AS __source_pk`;
      const inner = `SELECT ${idSelect}, q.* FROM (${sourceQuery}) AS q`;
      return { sql: inner, sourceLabel, mode: "query" };
    }

    if (!sourceTableEnv) {
      throw new ServiceUnavailableException(
        "SOURCE_TABLE is not set (and SOURCE_QUERY is empty)."
      );
    }
    if (!IDENT.test(sourceTableEnv)) {
      throw new BadRequestException(`Invalid SOURCE_TABLE: "${sourceTableEnv}".`);
    }

    const quoted = `"${sourceTableEnv.replace(/"/g, '""')}"`;
    const rowIdSelect = idColumn
      ? `"${idColumn.replace(/"/g, '""')}" AS __source_pk`
      : `rowid AS __rowid`;
    return {
      sql: `SELECT ${rowIdSelect}, * FROM ${quoted}`,
      sourceLabel,
      mode: "table",
    };
  }

  private skillColumnExpr(skillType: SkillType): string {
    const col =
      skillType === "active_skill"
        ? this.activeDescColumn()
        : this.leaderDescColumn();
    return `_src.${this.quotedColumn(col)}`;
  }

  private buildPatternWhere(
    selections: PatternTagSelection[],
    patternMatch: "any" | "all",
    params: unknown[]
  ): string | null {
    if (!selections.length) return null;

    const tagClauses: string[] = [];
    for (const sel of selections) {
      const clause = this.patterns.buildTagOrClause(
        sel.skillType,
        sel.tagKey,
        this.skillColumnExpr(sel.skillType),
        params
      );
      if (clause) tagClauses.push(clause);
    }

    if (!tagClauses.length) return null;
    const joiner = patternMatch === "all" ? " AND " : " OR ";
    return `(${tagClauses.join(joiner)})`;
  }

  private buildTextWhere(
    input: PatternSearchInput,
    params: unknown[]
  ): string[] {
    const clauses: string[] = [];
    const mode = input.skillTextMode ?? "both";
    const activeText = input.activeSkillText?.trim() ?? "";
    const leaderText = input.leaderSkillText?.trim() ?? "";

    const likeOn = (col: string, text: string) => {
      params.push(`%${text}%`);
      return `LOWER(COALESCE(_src.${this.quotedColumn(col)}, '')) LIKE LOWER(?)`;
    };

    if (mode === "active") {
      const text = activeText || leaderText;
      if (text) clauses.push(likeOn(this.activeDescColumn(), text));
    } else if (mode === "leader") {
      const text = leaderText || activeText;
      if (text) clauses.push(likeOn(this.leaderDescColumn(), text));
    } else {
      if (activeText) clauses.push(likeOn(this.activeDescColumn(), activeText));
      if (leaderText) clauses.push(likeOn(this.leaderDescColumn(), leaderText));
    }

    return clauses;
  }

  private buildMonsterWhere(
    monster: MonsterSearchFilters | undefined,
    params: unknown[]
  ): string[] {
    if (!monster) return [];
    const clauses: string[] = [];

    if (monster.rarity?.length) {
      const placeholders = monster.rarity.map(() => "?").join(", ");
      clauses.push(
        `_src.${this.quotedColumn("rarity")} IN (${placeholders})`
      );
      params.push(...monster.rarity);
    }

    if (monster.attributes?.length) {
      const cols = ["attribute_1_id", "attribute_2_id", "attribute_3_id"].map(
        (c) => `_src.${this.quotedColumn(c)}`
      );
      const attrParts = cols.map((col) => {
        const placeholders = monster.attributes!.map(() => "?").join(", ");
        return `${col} IN (${placeholders})`;
      });
      clauses.push(`(${attrParts.join(" OR ")})`);
      for (const _ of cols) {
        params.push(...monster.attributes!);
      }
    }

    const range = (
      col: string,
      min: number | null | undefined,
      max: number | null | undefined
    ) => {
      if (min != null && Number.isFinite(min)) {
        clauses.push(`_src.${this.quotedColumn(col)} >= ?`);
        params.push(min);
      }
      if (max != null && Number.isFinite(max)) {
        clauses.push(`_src.${this.quotedColumn(col)} <= ?`);
        params.push(max);
      }
    };

    range("hp_max", monster.hpMin, monster.hpMax);
    range("atk_max", monster.atkMin, monster.atkMax);
    range("rcv_max", monster.rcvMin, monster.rcvMax);

    const q = monster.idQuery?.trim();
    if (q) {
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      clauses.push(
        `(` +
          `CAST(COALESCE(_src.${this.quotedColumn("monster_id")}, _src.__source_pk, '') AS TEXT) LIKE ? OR ` +
          `CAST(COALESCE(_src.${this.quotedColumn("monster_no_na")}, '') AS TEXT) LIKE ? OR ` +
          `LOWER(COALESCE(_src.${this.quotedColumn("name_en")}, '')) LIKE LOWER(?)` +
          `)`
      );
    }

    if (monster.awakeningIds?.length) {
      const tokenLen = (id: number) => `(${id})`.length;

      const countClause = (id: number, minCount: number) => {
        const token = `(${id})`;
        const len = tokenLen(id);
        params.push(token, token, id, minCount);
        const awkCol = this.quotedColumn("awakenings");
        const superCol = this.quotedColumn("super_awakenings");
        const syncCol = this.quotedColumn("sync_awsid");
        return (
          `(` +
          `(LENGTH(COALESCE(_src.${awkCol}, '')) - LENGTH(REPLACE(COALESCE(_src.${awkCol}, ''), ?, ''))) / ${len} + ` +
          `(LENGTH(COALESCE(_src.${superCol}, '')) - LENGTH(REPLACE(COALESCE(_src.${superCol}, ''), ?, ''))) / ${len} + ` +
          `CASE WHEN _src.${syncCol} = ? THEN 1 ELSE 0 END` +
          `) >= ?`
        );
      };

      if (monster.awakeningMatch === "all") {
        const required = new Map<number, number>();
        for (const id of monster.awakeningIds) {
          required.set(id, (required.get(id) ?? 0) + 1);
        }
        const parts: string[] = [];
        for (const [id, minCount] of required) {
          parts.push(countClause(id, minCount));
        }
        clauses.push(`(${parts.join(" AND ")})`);
      } else {
        const unique = [...new Set(monster.awakeningIds)];
        const parts = unique.map((id) => countClause(id, 1));
        clauses.push(`(${parts.join(" OR ")})`);
      }
    }

    return clauses;
  }

  private compileWhere(input: PatternSearchInput): {
    whereSql: string;
    params: unknown[];
    selections: PatternTagSelection[];
  } {
    const params: unknown[] = [];
    const selections = this.patterns.resolveSelections(
      input.activeTags,
      input.leaderTags
    );

    const parts: string[] = [];
    const patternWhere = this.buildPatternWhere(
      selections,
      input.patternMatch,
      params
    );
    if (patternWhere) parts.push(patternWhere);
    parts.push(...this.buildTextWhere(input, params));
    parts.push(...this.buildMonsterWhere(input.monster, params));

    const whereSql = parts.length ? `WHERE ${parts.join(" AND ")}` : "";
    return { whereSql, params, selections };
  }

  async search(input: PatternSearchInput): Promise<{
    sourceLabel: string;
    mode: "query" | "table";
    patternMatch: "any" | "all";
    activeTags: string[];
    leaderTags: string[];
    total: number;
    limit: number;
    offset: number;
    rows: Record<string, unknown>[];
  }> {
    const { sql: inner, sourceLabel, mode } = this.buildSourceSubquery();
    const { whereSql, params, selections } = this.compileWhere(input);

    const baseFrom = `FROM (${inner}) AS _src ${whereSql}`;
    const countSql = `SELECT COUNT(*) AS cnt ${baseFrom}`;
    const countRow = (await this.dataSource.query(countSql, params)) as {
      cnt: number;
    }[];
    const total = Number(countRow[0]?.cnt ?? 0);

    const dataParams = [...params, input.limit, input.offset];
    const dataSql =
      `SELECT _src.* ${baseFrom} LIMIT ? OFFSET ?`;
    let rows = (await this.dataSource.query(dataSql, dataParams)) as Record<
      string,
      unknown
    >[];
    rows = projectSourceRows(rows, getSourceColumnWhitelistFromEnv());

    return {
      sourceLabel,
      mode,
      patternMatch: input.patternMatch,
      activeTags: selections
        .filter((s) => s.skillType === "active_skill")
        .map((s) => s.tagKey),
      leaderTags: selections
        .filter((s) => s.skillType === "leader_skill")
        .map((s) => s.tagKey),
      total,
      limit: input.limit,
      offset: input.offset,
      rows,
    };
  }
}
