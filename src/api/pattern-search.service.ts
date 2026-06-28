import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  equivalenceRulesAsBase,
  equivalenceRulesAsComposite,
} from "../awakening-equivalence";
import { PatternCatalogService } from "../patterns/pattern-catalog.service";
import type { PatternTagSelection, SkillType } from "../patterns/pattern-types";
import {
  getSourceColumnWhitelistFromEnv,
  projectSourceRows,
} from "../transform/source-row-projection";
import {
  hasVanishFilters,
  VanishAwokenService,
  type VanishSearchFilters,
} from "./vanish-awoken.service";

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export type MonsterSearchFilters = {
  rarity?: number[];
  attributeSlots?: [number[], number[], number[]];
  attributeMatch?: "any" | "all";
  types?: number[];
  hpMin?: number | null;
  hpMax?: number | null;
  atkMin?: number | null;
  atkMax?: number | null;
  rcvMin?: number | null;
  rcvMax?: number | null;
  idQuery?: string;
  awakeningIds?: number[];
  awakeningMatch?: "any" | "all";
  excludedAwakeningIds?: number[];
};

export type PatternSearchInput = {
  activeTags: string[];
  leaderTags: string[];
  patternMatch: "any" | "all";
  activeSkillText?: string;
  leaderSkillText?: string;
  skillTextMode?: "both" | "active" | "leader";
  monster?: MonsterSearchFilters;
  vanish?: VanishSearchFilters;
  limit: number;
  offset: number;
};

@Injectable()
export class PatternSearchService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly patterns: PatternCatalogService,
    private readonly vanish: VanishAwokenService
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

  private awakeningTokenCountExpr(
    id: number,
    textExpr: string,
    params: unknown[]
  ): string {
    const token = `(${id})`;
    const len = token.length;
    params.push(token);
    return `(LENGTH(COALESCE(${textExpr}, '')) - LENGTH(REPLACE(COALESCE(${textExpr}, ''), ?, ''))) / ${len}`;
  }

  /** Text before the first `|` in dadguide `awakenings` (regular slots only). */
  private regularAwakeningsExpr(awkCol: string): string {
    return (
      `SUBSTR(COALESCE(${awkCol}, ''), 1, ` +
      `CASE WHEN INSTR(COALESCE(${awkCol}, ''), '|') > 0 ` +
      `THEN INSTR(COALESCE(${awkCol}, ''), '|') - 1 ` +
      `ELSE LENGTH(COALESCE(${awkCol}, '')) END)`
    );
  }

  /**
   * Super awakening text: `super_awakenings` column, else `|` suffix on `awakenings`
   * (same resolution as web `resolveSuperAwakeningIds`).
   */
  private superAwakeningsExpr(awkCol: string, superCol: string): string {
    return (
      `CASE WHEN TRIM(COALESCE(${superCol}, '')) != '' ` +
      `THEN COALESCE(${superCol}, '') ` +
      `WHEN INSTR(COALESCE(${awkCol}, ''), '|') > 0 ` +
      `THEN SUBSTR(COALESCE(${awkCol}, ''), INSTR(COALESCE(${awkCol}, ''), '|') + 1) ` +
      `ELSE '' END`
    );
  }

  /** Raw slot count for one awk id (regular + super + sync). Returns a SQL sub-expression. */
  private rawAwakeningCountExpr(
    id: number,
    regularExpr: string,
    superExpr: string,
    syncCol: string,
    params: unknown[]
  ): string {
    const regularCount = this.awakeningTokenCountExpr(id, regularExpr, params);
    const superCount = this.awakeningTokenCountExpr(id, superExpr, params);
    params.push(id);
    return (
      `(${regularCount} + ${superCount} + ` +
      `CASE WHEN ${syncCol} = ? THEN 1 ELSE 0 END)`
    );
  }

  /**
   * Effective awk count for filtering, including composite/base equivalence
   * (e.g. one 56 counts as two 21; two 21 count as one 56).
   */
  private awakeningCountClause(
    filterId: number,
    minCount: number,
    params: unknown[]
  ): string {
    const awkCol = `_src.${this.quotedColumn("awakenings")}`;
    const superCol = `_src.${this.quotedColumn("super_awakenings")}`;
    const syncCol = `_src.${this.quotedColumn("sync_awsid")}`;
    const regularExpr = this.regularAwakeningsExpr(awkCol);
    const superExpr = this.superAwakeningsExpr(awkCol, superCol);

    const parts: string[] = [
      this.rawAwakeningCountExpr(
        filterId,
        regularExpr,
        superExpr,
        syncCol,
        params
      ),
    ];

    for (const rule of equivalenceRulesAsBase(filterId)) {
      parts.push(
        `(${this.rawAwakeningCountExpr(
          rule.composite,
          regularExpr,
          superExpr,
          syncCol,
          params
        )} * ${rule.basePerComposite})`
      );
    }

    for (const rule of equivalenceRulesAsComposite(filterId)) {
      parts.push(
        `((${this.rawAwakeningCountExpr(
          rule.base,
          regularExpr,
          superExpr,
          syncCol,
          params
        )}) / ${rule.basePerComposite})`
      );
    }

    params.push(minCount);
    return `(${parts.join(" + ")}) >= ?`;
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

    if (monster.attributeSlots?.some((slot) => slot.length > 0)) {
      const cols = ["attribute_1_id", "attribute_2_id", "attribute_3_id"];
      const match = monster.attributeMatch === "any" ? "any" : "all";
      const slotClauses: string[] = [];

      for (let i = 0; i < cols.length; i++) {
        const ids = monster.attributeSlots![i];
        if (!ids?.length) continue;
        const col = `_src.${this.quotedColumn(cols[i])}`;
        const placeholders = ids.map(() => "?").join(", ");
        slotClauses.push(`${col} IN (${placeholders})`);
        params.push(...ids);
      }

      if (slotClauses.length) {
        const joiner = match === "all" ? " AND " : " OR ";
        clauses.push(`(${slotClauses.join(joiner)})`);
      }
    }

    if (monster.types?.length) {
      const cols = ["type_1_id", "type_2_id", "type_3_id"].map(
        (c) => `_src.${this.quotedColumn(c)}`
      );
      const typeParts = cols.map((col) => {
        const placeholders = monster.types!.map(() => "?").join(", ");
        return `${col} IN (${placeholders})`;
      });
      clauses.push(`(${typeParts.join(" OR ")})`);
      for (const _ of cols) {
        params.push(...monster.types!);
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

    const hasAwakeningInclude = (monster.awakeningIds?.length ?? 0) > 0;
    const hasAwakeningExclude = (monster.excludedAwakeningIds?.length ?? 0) > 0;

    if (hasAwakeningInclude || hasAwakeningExclude) {
      if (hasAwakeningInclude) {
        if (monster.awakeningMatch === "all") {
          const required = new Map<number, number>();
          for (const id of monster.awakeningIds!) {
            required.set(id, (required.get(id) ?? 0) + 1);
          }
          const parts: string[] = [];
          for (const [id, minCount] of required) {
            parts.push(this.awakeningCountClause(id, minCount, params));
          }
          clauses.push(`(${parts.join(" AND ")})`);
        } else {
          const unique = [...new Set(monster.awakeningIds!)];
          const parts = unique.map((id) =>
            this.awakeningCountClause(id, 1, params)
          );
          clauses.push(`(${parts.join(" OR ")})`);
        }
      }

      if (hasAwakeningExclude) {
        const unique = [...new Set(monster.excludedAwakeningIds!)];
        const parts = unique.map(
          (id) => `NOT (${this.awakeningCountClause(id, 1, params)})`
        );
        clauses.push(`(${parts.join(" AND ")})`);
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
    parts.push(...this.vanish.buildVanishWhere(input.vanish, params));

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

    const vanishAttached = await this.vanish.ensureAttached();
    const vanishFilterActive = vanishAttached && hasVanishFilters(input.vanish);
    const vanishEnrich = vanishAttached;
    const joinSql =
      vanishFilterActive || vanishEnrich ? ` ${this.vanish.joinSql()}` : "";
    const selectExtra =
      vanishEnrich ? `, ${this.vanish.selectSql()}` : "";

    const baseFrom = `FROM (${inner}) AS _src${joinSql} ${whereSql}`;
    const countSql = `SELECT COUNT(*) AS cnt ${baseFrom}`;
    const countRow = (await this.dataSource.query(countSql, params)) as {
      cnt: number;
    }[];
    const total = Number(countRow[0]?.cnt ?? 0);

    const dataParams = [...params, input.limit, input.offset];
    const dataSql =
      `SELECT _src.*${selectExtra} ${baseFrom} LIMIT ? OFFSET ?`;
    let rows = (await this.dataSource.query(dataSql, dataParams)) as Record<
      string,
      unknown
    >[];
    if (vanishEnrich) {
      rows = this.vanish.enrichRows(rows);
    }
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
