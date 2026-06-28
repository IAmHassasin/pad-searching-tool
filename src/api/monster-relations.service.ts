import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  getSourceColumnWhitelistFromEnv,
  projectSourceRows,
} from "../transform/source-row-projection";
import { VanishAwokenService } from "./vanish-awoken.service";

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
/** dadguide `d_types.type_id` — Redeemable Mats */
const REDEEMABLE_MAT_TYPE_ID = 15;

const EXCLUDE_REDEEMABLE_MATS_SQL = `
  type_1_id != ${REDEEMABLE_MAT_TYPE_ID}
  AND (type_2_id IS NULL OR type_2_id != ${REDEEMABLE_MAT_TYPE_ID})
  AND (type_3_id IS NULL OR type_3_id != ${REDEEMABLE_MAT_TYPE_ID})
`;

@Injectable()
export class MonsterRelationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly vanish: VanishAwokenService
  ) {}

  private buildSourceSubquery(): string {
    const sourceQuery = process.env.SOURCE_QUERY?.trim();
    const sourceTableEnv = process.env.SOURCE_TABLE?.trim();
    const idColumn = process.env.SOURCE_ID_COLUMN?.trim() || "monster_id";

    if (!IDENT.test(idColumn)) {
      throw new BadRequestException(`Invalid SOURCE_ID_COLUMN: "${idColumn}".`);
    }

    if (sourceQuery) {
      const idSelect = `"${idColumn.replace(/"/g, '""')}" AS __source_pk`;
      return `SELECT ${idSelect}, q.* FROM (${sourceQuery}) AS q`;
    }

    if (!sourceTableEnv || !IDENT.test(sourceTableEnv)) {
      throw new BadRequestException("SOURCE_TABLE or SOURCE_QUERY must be configured.");
    }

    const quoted = `"${sourceTableEnv.replace(/"/g, '""')}"`;
    return `SELECT "${idColumn.replace(/"/g, '""')}" AS __source_pk, * FROM ${quoted}`;
  }

  private async fetchMonstersByIds(
    ids: number[]
  ): Promise<Record<string, unknown>[]> {
    if (!ids.length) return [];
    const inner = this.buildSourceSubquery();
    const placeholders = ids.map(() => "?").join(", ");
    const vanishAttached = await this.vanish.ensureAttached();
    const joinSql = vanishAttached ? ` ${this.vanish.joinSql()}` : "";
    const selectExtra = vanishAttached ? `, ${this.vanish.selectSql()}` : "";
    const sql =
      `SELECT _src.*${selectExtra} FROM (${inner}) AS _src${joinSql} ` +
      `WHERE _src."monster_id" IN (${placeholders})`;
    let rows = (await this.dataSource.query(sql, ids)) as Record<
      string,
      unknown
    >[];
    if (vanishAttached) {
      rows = this.vanish.enrichRows(rows);
    }
    return projectSourceRows(rows, getSourceColumnWhitelistFromEnv());
  }

  private async resolveIds(
    monsterId: number
  ): Promise<{ baseId: number; groupId: number }> {
    const rows = (await this.dataSource.query(
      `SELECT base_id, group_id FROM monsters WHERE monster_id = ?`,
      [monsterId]
    )) as { base_id: number; group_id: number }[];
    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Monster ${monsterId} not found.`);
    }
    return { baseId: row.base_id, groupId: row.group_id };
  }

  async lookupMonstersByIds(
    ids: number[]
  ): Promise<Record<string, unknown>[]> {
    const unique = [
      ...new Set(ids.filter((id) => Number.isFinite(id) && id > 0)),
    ];
    if (!unique.length) return [];
    return this.fetchMonstersByIds(unique);
  }

  async getEvoTree(monsterId: number): Promise<{
    monsterId: number;
    baseId: number;
    nodes: Record<string, unknown>[];
    edges: { from: number; to: number }[];
  }> {
    if (!Number.isFinite(monsterId) || monsterId <= 0) {
      throw new BadRequestException("Invalid monsterId.");
    }

    const { baseId } = await this.resolveIds(monsterId);

    const idRows = (await this.dataSource.query(
      `SELECT monster_id FROM monsters WHERE base_id = ? ORDER BY rarity, monster_id`,
      [baseId]
    )) as { monster_id: number }[];
    const ids = idRows.map((r) => r.monster_id);
    const nodes = await this.fetchMonstersByIds(ids);

    const edgeRows =
      ids.length > 1
        ? ((await this.dataSource.query(
            `SELECT from_id, to_id FROM evolutions
             WHERE from_id IN (${ids.map(() => "?").join(", ")})
               AND to_id IN (${ids.map(() => "?").join(", ")})`,
            [...ids, ...ids]
          )) as { from_id: number; to_id: number }[])
        : [];

    return {
      monsterId,
      baseId,
      nodes,
      edges: edgeRows.map((e) => ({ from: e.from_id, to: e.to_id })),
    };
  }

  async getCollabGroup(monsterId: number): Promise<{
    monsterId: number;
    groupId: number;
    groupName: string | null;
    byRarity: { rarity: number; monsters: Record<string, unknown>[] }[];
  }> {
    if (!Number.isFinite(monsterId) || monsterId <= 0) {
      throw new BadRequestException("Invalid monsterId.");
    }

    const { groupId } = await this.resolveIds(monsterId);
    if (!groupId) {
      return {
        monsterId,
        groupId: 0,
        groupName: null,
        byRarity: [],
      };
    }

    const nameRows = (await this.dataSource.query(
      `SELECT s.name_en
       FROM series s
       JOIN monster_series ms ON ms.series_id = s.series_id
       JOIN monsters m ON m.monster_id = ms.monster_id
       WHERE m.group_id = ?
       ORDER BY CASE WHEN s.series_type = 'collab' THEN 0 ELSE 1 END, ms.priority
       LIMIT 1`,
      [groupId]
    )) as { name_en: string }[];

    const idRows = (await this.dataSource.query(
      `SELECT monster_id, rarity FROM monsters
       WHERE group_id = ? AND monster_id = base_id
         AND ${EXCLUDE_REDEEMABLE_MATS_SQL}
       ORDER BY rarity DESC, monster_id`,
      [groupId]
    )) as { monster_id: number; rarity: number }[];

    const ids = idRows.map((r) => r.monster_id);
    const fetched = await this.fetchMonstersByIds(ids);
    const byId = new Map(
      fetched.map((row) => [Number(row.monster_id), row] as const)
    );

    const rarityMap = new Map<number, Record<string, unknown>[]>();
    for (const { monster_id, rarity } of idRows) {
      const row = byId.get(monster_id);
      if (!row) continue;
      const list = rarityMap.get(rarity) ?? [];
      list.push(row);
      rarityMap.set(rarity, list);
    }

    const byRarity = [...rarityMap.entries()]
      .sort(([a], [b]) => b - a)
      .map(([rarity, monsters]) => ({ rarity, monsters }));

    return {
      monsterId,
      groupId,
      groupName: nameRows[0]?.name_en?.trim() || null,
      byRarity,
    };
  }
}
