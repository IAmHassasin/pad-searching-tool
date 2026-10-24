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
import { EffectValueCatalogService } from "../patterns/effect-value-catalog.service";
import type { EffectValueRangeInput } from "../patterns/effect-value-types";
import {
  appendEffectTagClause,
  DEFAULT_EFFECT_TAG_COLUMNS,
  joinEffectClauses,
  skillTagIdFromKey,
  type EffectColumnExprs,
} from "../patterns/effect-filter-sql";
import { PatternCatalogService } from "../patterns/pattern-catalog.service";
import { cooldownSql, skillTextTermsSql } from "../patterns/skill-search-sql";
import type { PatternTagSelection, SkillType } from "../patterns/pattern-types";
import { VOID_SUPER_GRAVITY_TAG_KEY } from "../patterns/supplement-pattern-tags";
import {
  getSourceColumnWhitelistFromEnv,
  projectSourceRows,
} from "../transform/source-row-projection";
import {
  hasVanishFilters,
  VanishAwokenService,
  type VanishSearchFilters,
} from "./vanish-awoken.service";
import {
  parseSearchMinMonsterId,
  resolveSearchIdQuery,
  type SearchIdQueryResolution,
} from "./search-id-query";
import {
  buildNameSearchMatchSql,
  escapeLikeContains,
  GROUP_NAME_MATCH_TABLES,
} from "./search-group-match";
import { VoidSuperGravityService } from "./void-super-gravity.service";

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
  /** Active skill CD at max skill level; one bound alone means "equals". */
  activeCdMin?: number | null;
  activeCdMax?: number | null;
  monster?: MonsterSearchFilters;
  vanish?: VanishSearchFilters;
  /** Numeric effect-value ranges (shield %, xN HP, charge turns, …). */
  effectRanges?: EffectValueRangeInput[];
  limit: number;
  offset: number;
  /** Skip COUNT(*) — used for follow-up pages that already know `total`. */
  skipCount?: boolean;
};

@Injectable()
export class PatternSearchService {
  /** Null until the first search checks that series tables exist. */
  private groupSeriesReady: boolean | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly patterns: PatternCatalogService,
    private readonly effectValues: EffectValueCatalogService,
    private readonly vanish: VanishAwokenService,
    private readonly voidSuperGravity: VoidSuperGravityService
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

  private effectColumnExprs(): EffectColumnExprs {
    const activeCol =
      process.env.FILTER_TAGS_COLUMN?.trim() ||
      DEFAULT_EFFECT_TAG_COLUMNS.active;
    const leaderCol =
      process.env.FILTER_LEADER_TAGS_COLUMN?.trim() ||
      DEFAULT_EFFECT_TAG_COLUMNS.leader;
    return {
      activeTags: `_src.${this.quotedColumn(activeCol)}`,
      leaderTags: `_src.${this.quotedColumn(leaderCol)}`,
      monsterId: `_src.${this.quotedColumn(DEFAULT_EFFECT_TAG_COLUMNS.monsterId)}`,
    };
  }

  /**
   * Chip clauses, each AND'ed with the value / turn ranges that tune it, then
   * joined with patternMatch. Returns the ranges it consumed so the rest can
   * still be applied as standalone requirements.
   */
  private buildPatternWhere(
    selections: PatternTagSelection[],
    patternMatch: "any" | "all",
    params: unknown[],
    vsgAttached: boolean,
    effectRanges: EffectValueRangeInput[] | undefined
  ): { where: string | null; usedRanges: Set<EffectValueRangeInput> } {
    const usedRanges = new Set<EffectValueRangeInput>();
    if (!selections.length) return { where: null, usedRanges };

    const exprs = this.effectColumnExprs();
    const tagClauses: string[] = [];
    for (const sel of selections) {
      if (sel.tagKey === VOID_SUPER_GRAVITY_TAG_KEY) {
        tagClauses.push(
          vsgAttached ? `_vsg.monster_id IS NOT NULL` : `1=0`
        );
        continue;
      }
      const tagId = skillTagIdFromKey(sel.tagKey);
      const clause =
        tagId != null
          ? appendEffectTagClause(sel.skillType, tagId, exprs, params)
          : this.patterns.buildTagOrClause(
              sel.skillType,
              sel.tagKey,
              this.skillColumnExpr(sel.skillType),
              params
            );
      if (!clause) continue;

      const tuning: string[] = [];
      for (const range of this.effectValues.rangesForTag(
        sel.skillType,
        sel.tagKey,
        effectRanges
      )) {
        usedRanges.add(range);
        const rangeClause = this.effectValues.buildRangeClause(
          range,
          (skillType) => this.skillColumnExpr(skillType),
          params
        );
        if (rangeClause) tuning.push(rangeClause);
      }
      tagClauses.push(
        tuning.length ? `(${[clause, ...tuning].join(" AND ")})` : clause
      );
    }

    return { where: joinEffectClauses(tagClauses, patternMatch), usedRanges };
  }

  private buildTextWhere(
    input: PatternSearchInput,
    params: unknown[]
  ): string[] {
    const clauses: string[] = [];
    const mode = input.skillTextMode ?? "both";
    const activeText = input.activeSkillText?.trim() ?? "";
    const leaderText = input.leaderSkillText?.trim() ?? "";

    const termsOn = (col: string, text: string) => {
      const clause = skillTextTermsSql(
        text,
        `_src.${this.quotedColumn(col)}`,
        params
      );
      if (clause) clauses.push(clause);
    };

    if (mode === "active") {
      termsOn(this.activeDescColumn(), activeText || leaderText);
    } else if (mode === "leader") {
      termsOn(this.leaderDescColumn(), leaderText || activeText);
    } else {
      termsOn(this.activeDescColumn(), activeText);
      termsOn(this.leaderDescColumn(), leaderText);
    }

    const cdClause = cooldownSql(
      input.activeCdMin,
      input.activeCdMax,
      `_src.${this.quotedColumn("active_skill_cooldown_min")}`,
      params
    );
    if (cdClause) clauses.push(cdClause);

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

  private compileWhere(
    input: PatternSearchInput,
    attach: { vanishAttached: boolean; vsgAttached: boolean },
    groupSeriesReady: boolean
  ): {
    whereSql: string;
    params: unknown[];
    selections: PatternTagSelection[];
    idQuery: SearchIdQueryResolution;
    groupJoinSql: string;
    groupSelectSql: string;
  } {
    const params: unknown[] = [];
    const selections = this.patterns.resolveSelections(
      input.activeTags,
      input.leaderTags
    );

    const parts: string[] = [];
    const { where: patternWhere, usedRanges } = this.buildPatternWhere(
      selections,
      input.patternMatch,
      params,
      attach.vsgAttached,
      input.effectRanges
    );
    if (patternWhere) parts.push(patternWhere);
    parts.push(...this.buildTextWhere(input, params));
    parts.push(...this.buildMonsterWhere(input.monster, params));
    const idQuery = resolveSearchIdQuery(
      input.monster?.idQuery,
      parseSearchMinMonsterId(process.env.SEARCH_MIN_MONSTER_ID)
    );
    const floorGroupRoster =
      groupSeriesReady &&
      idQuery.likeQuery != null &&
      idQuery.applyMinId &&
      idQuery.minMonsterId > 0;
    if (idQuery.applyMinId && idQuery.minMonsterId > 0 && !floorGroupRoster) {
      parts.push(this.minMonsterIdClause());
      params.push(idQuery.minMonsterId);
    }
    if (idQuery.exactId != null) {
      parts.push(this.exactMonsterIdClause());
      params.push(idQuery.exactId, idQuery.exactId);
    }
    let groupJoinSql = "";
    let groupSelectSql = "";
    const leadingParams: unknown[] = [];
    if (idQuery.likeQuery != null) {
      const pattern = escapeLikeContains(idQuery.likeQuery);
      const match = buildNameSearchMatchSql(
        (column) => this.quotedColumn(column),
        groupSeriesReady,
        floorGroupRoster
      );
      if (match.joinConsumesPattern) leadingParams.push(pattern);
      params.push(pattern, pattern, pattern);
      if (match.textMatchConsumesMinId) params.push(idQuery.minMonsterId);
      groupJoinSql = match.joinSql;
      groupSelectSql = match.selectSql;
      parts.push(match.whereSql);
    }
    // Ranges not tied to a selected chip (e.g. old share links) stay global.
    const effectWhere = this.effectValues.buildWhere(
      input.effectRanges?.filter((r) => !usedRanges.has(r)),
      (skillType) => this.skillColumnExpr(skillType),
      params
    );
    if (effectWhere) parts.push(effectWhere);
    if (attach.vanishAttached && hasVanishFilters(input.vanish)) {
      parts.push(...this.vanish.buildVanishWhere(input.vanish, params));
    }

    const whereSql = parts.length ? `WHERE ${parts.join(" AND ")}` : "";
    return {
      whereSql,
      params: leadingParams.length ? [...leadingParams, ...params] : params,
      selections,
      idQuery,
      groupJoinSql,
      groupSelectSql,
    };
  }

  /**
   * Series tables are missing on some local/test databases. Name and ID search
   * still run; group matching stays off until those tables are present.
   */
  private async groupSeriesTablesReady(): Promise<boolean> {
    if (this.groupSeriesReady != null) return this.groupSeriesReady;
    const rows = (await this.dataSource.query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${GROUP_NAME_MATCH_TABLES.map(() => "?").join(", ")})`,
      [...GROUP_NAME_MATCH_TABLES]
    )) as { name: string }[];
    const found = new Set(rows.map((row) => row.name));
    this.groupSeriesReady = GROUP_NAME_MATCH_TABLES.every((name) =>
      found.has(name)
    );
    return this.groupSeriesReady;
  }

  private minMonsterIdClause(): string {
    return `CAST(COALESCE(_src.${this.quotedColumn("monster_id")}, _src.__source_pk) AS INTEGER) >= ?`;
  }

  private exactMonsterIdClause(): string {
    return (
      `(` +
      `CAST(COALESCE(_src.${this.quotedColumn("monster_id")}, _src.__source_pk) AS INTEGER) = ? OR ` +
      `CAST(COALESCE(_src.${this.quotedColumn("monster_no_na")}, 0) AS INTEGER) = ?` +
      `)`
    );
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
    minMonsterId: number;
    modernOnly: boolean;
    rows: Record<string, unknown>[];
  }> {
    const { sql: inner, sourceLabel, mode } = this.buildSourceSubquery();

    const vanishAttached = await this.vanish.ensureAttached();
    const vsgAttached = await this.voidSuperGravity.ensureAttached();
    const vsgTagSelected = input.activeTags.includes(VOID_SUPER_GRAVITY_TAG_KEY);

    const groupSeriesReady = await this.groupSeriesTablesReady();
    const {
      whereSql,
      params,
      selections,
      idQuery,
      groupJoinSql,
      groupSelectSql,
    } = this.compileWhere(
      input,
      {
        vanishAttached,
        vsgAttached,
      },
      groupSeriesReady
    );

    const joinParts: string[] = [];
    if (vanishAttached) {
      joinParts.push(this.vanish.joinSql());
    }
    if (vsgAttached) {
      joinParts.push(this.voidSuperGravity.joinSql());
    }
    const joinSql = joinParts.length ? ` ${joinParts.join(" ")}` : "";
    const selectParts: string[] = [];
    if (vanishAttached) selectParts.push(this.vanish.selectSql());
    if (vsgAttached) selectParts.push(this.voidSuperGravity.selectSql());
    const selectExtra = selectParts.length ? `, ${selectParts.join(", ")}` : "";

    const groupJoin = groupJoinSql ? ` ${groupJoinSql}` : "";
    const baseFrom = `FROM (${inner}) AS _src${joinSql}${groupJoin} ${whereSql}`;
    let total = 0;
    if (!input.skipCount) {
      const countSql = `SELECT COUNT(*) AS cnt ${baseFrom}`;
      const countRow = (await this.dataSource.query(countSql, params)) as {
        cnt: number;
      }[];
      total = Number(countRow[0]?.cnt ?? 0);
    }

    const dataParams = [...params, input.limit, input.offset];
    const groupSelect = groupSelectSql ? `, ${groupSelectSql}` : "";
    const dataSql =
      `SELECT _src.*${selectExtra}${groupSelect} ${baseFrom} LIMIT ? OFFSET ?`;
    let rows = (await this.dataSource.query(dataSql, dataParams)) as Record<
      string,
      unknown
    >[];
    if (vanishAttached) {
      rows = this.vanish.enrichRows(rows);
    }
    if (vsgAttached) {
      rows = this.voidSuperGravity.enrichRows(rows);
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
      minMonsterId: idQuery.minMonsterId,
      modernOnly: idQuery.modernOnly,
      rows,
    };
  }
}
