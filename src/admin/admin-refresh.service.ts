import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { runCommunityDbImport } from "../import/import-external-db.core";
import { registerDataSourceRegexp } from "../patterns/register-sqlite-regexp";

@Injectable()
export class AdminRefreshService {
  private readonly logger = new Logger(AdminRefreshService.name);
  private refreshing = false;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  isRefreshing(): boolean {
    return this.refreshing;
  }

  async refreshCommunityDb(): Promise<{
    ok: true;
    finishedAt: string;
    import: Awaited<ReturnType<typeof runCommunityDbImport>>;
  }> {
    if (this.refreshing) {
      throw new ConflictException("Database refresh is already in progress");
    }

    this.refreshing = true;
    const started = Date.now();
    this.logger.warn("Admin DB refresh started — closing SQLite connection…");

    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }

      const importResult = await runCommunityDbImport({ mode: "merge" });

      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
        registerDataSourceRegexp(this.dataSource);
      }

      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      this.logger.warn(
        `Admin DB refresh finished in ${elapsed}s — ${importResult.tablesReplaced.length} table(s) replaced`
      );

      return {
        ok: true,
        finishedAt: new Date().toISOString(),
        import: importResult,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Admin DB refresh failed: ${msg}`);

      try {
        if (!this.dataSource.isInitialized) {
          await this.dataSource.initialize();
          registerDataSourceRegexp(this.dataSource);
        }
      } catch (reconnectErr: unknown) {
        const reconnectMsg =
          reconnectErr instanceof Error
            ? reconnectErr.message
            : String(reconnectErr);
        throw new ServiceUnavailableException(
          `Refresh failed (${msg}) and SQLite reconnect failed (${reconnectMsg}). Restart the server.`
        );
      }

      throw e;
    } finally {
      this.refreshing = false;
    }
  }
}
