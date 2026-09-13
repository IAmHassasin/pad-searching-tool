import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { VanishAwokenService } from "../api/vanish-awoken.service";
import { VoidSuperGravityService } from "../api/void-super-gravity.service";
import { runCommunityDbImport } from "../import/import-external-db.core";
import { registerDataSourceRegexp } from "../patterns/register-sqlite-regexp";
import { AdminJobLock } from "./admin-job-lock";

@Injectable()
export class AdminRefreshService {
  private readonly logger = new Logger(AdminRefreshService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly vanish: VanishAwokenService,
    private readonly voidSuperGravity: VoidSuperGravityService,
    private readonly jobs: AdminJobLock
  ) {}

  isRefreshing(): boolean {
    return this.jobs.isRunning();
  }

  async refreshCommunityDb(): Promise<{
    ok: true;
    finishedAt: string;
    import: Awaited<ReturnType<typeof runCommunityDbImport>>;
  }> {
    this.jobs.begin("Database refresh");
    const started = Date.now();
    this.logger.warn("Admin DB refresh started — closing SQLite connection…");

    try {
      this.vanish.resetAttachment();
      this.voidSuperGravity.resetAttachment();
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }

      const importResult = await runCommunityDbImport({ mode: "merge" });

      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
        registerDataSourceRegexp(this.dataSource);
      }
      this.vanish.resetAttachment();
      this.voidSuperGravity.resetAttachment();

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
      this.jobs.end();
    }
  }
}
