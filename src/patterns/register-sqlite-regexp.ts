import type Database from "better-sqlite3";
import type { DataSource } from "typeorm";

const FLAG = "__padRegexpRegistered";

export function registerSqliteRegexp(db: Database.Database): void {
  const marked = db as Database.Database & { [FLAG]?: boolean };
  if (marked[FLAG]) return;

  db.function(
    "regexp",
    { deterministic: true },
    (pattern: unknown, value: unknown) => {
      if (pattern == null || value == null) return 0;
      try {
        return new RegExp(String(pattern)).test(String(value)) ? 1 : 0;
      } catch {
        return 0;
      }
    }
  );

  marked[FLAG] = true;
}

export function registerDataSourceRegexp(dataSource: DataSource): void {
  const driver = dataSource.driver as {
    databaseConnection?: Database.Database;
  };
  const db = driver.databaseConnection;
  if (!db) {
    throw new Error("better-sqlite3 connection not available for REGEXP setup");
  }
  registerSqliteRegexp(db);
}
