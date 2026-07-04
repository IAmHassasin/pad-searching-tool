import type { Logger } from "@nestjs/common";
import type { DataSource } from "typeorm";

export type SupplementAttachCache = {
  attachedPath: string | null;
};

export async function queryAliasTableExists(
  dataSource: DataSource,
  alias: string,
  tableName: string
): Promise<boolean> {
  try {
    const rows = (await dataSource.query(
      `SELECT 1 FROM ${alias}.sqlite_master ` +
        `WHERE type = 'table' AND name = ? LIMIT 1`,
      [tableName]
    )) as unknown[];
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function detachSupplementDb(
  dataSource: DataSource,
  alias: string,
  cache: SupplementAttachCache
): Promise<void> {
  try {
    await dataSource.query(`DETACH DATABASE ${alias}`);
  } catch {
    // already detached or never attached
  }
  cache.attachedPath = null;
}

export async function ensureSupplementDbAttached(
  dataSource: DataSource,
  opts: {
    alias: string;
    tableName: string;
    path: string;
    cache: SupplementAttachCache;
    logger: Logger;
    label: string;
  }
): Promise<boolean> {
  const { alias, tableName, path, cache, logger, label } = opts;

  if (
    cache.attachedPath === path &&
    (await queryAliasTableExists(dataSource, alias, tableName))
  ) {
    return true;
  }

  if (await queryAliasTableExists(dataSource, alias, tableName)) {
    cache.attachedPath = path;
    return true;
  }

  if (cache.attachedPath) {
    await detachSupplementDb(dataSource, alias, cache);
  } else {
    try {
      await dataSource.query(`DETACH DATABASE ${alias}`);
    } catch {
      // orphan attach from stale cache — ignore
    }
  }

  const escaped = path.replace(/'/g, "''");
  try {
    await dataSource.query(`ATTACH DATABASE '${escaped}' AS ${alias}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already in use|already attached/i.test(msg)) {
      if (await queryAliasTableExists(dataSource, alias, tableName)) {
        cache.attachedPath = path;
        return true;
      }
    }
    logger.warn(`Could not attach ${label} DB at ${path}: ${msg}`);
    return false;
  }

  if (!(await queryAliasTableExists(dataSource, alias, tableName))) {
    logger.warn(`${label} DB at ${path} is missing ${tableName} table`);
    await detachSupplementDb(dataSource, alias, cache);
    return false;
  }

  cache.attachedPath = path;
  return true;
}
