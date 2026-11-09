import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  VanishAwokenService,
  type VanishDeltaRefreshReport,
} from "../api/vanish-awoken.service";
import { VoidSuperGravityService } from "../api/void-super-gravity.service";
import { runCommunityDbImport } from "../import/import-external-db.core";
import { registerDataSourceRegexp } from "../patterns/register-sqlite-regexp";
import { AdminJobLock } from "./admin-job-lock";

export type VanishRefreshOutcome =
  | ({ ok: true } & VanishDeltaRefreshReport)
  | { ok: false; error: string };

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
    vanish: VanishRefreshOutcome;
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

      const vanish = await this.refreshVanishDelta();

      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      this.logger.warn(
        `Admin DB refresh finished in ${elapsed}s — ${importResult.tablesReplaced.length} table(s) replaced`
      );

      return {
        ok: true,
        finishedAt: new Date().toISOString(),
        import: importResult,
        vanish,
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

  /**
   * Latest GameWith vanish assists → delta DB. Runs after the community merge;
   * a failure here keeps the previous delta and is reported as a warning
   * instead of failing the whole refresh.
   */
  private async refreshVanishDelta(): Promise<VanishRefreshOutcome> {
    try {
      const report = await this.vanish.refreshDeltaFromGameWith();
      this.logger.log(
        `Vanish delta: ${report.inserted} added, ${report.updated} updated, ` +
          `${report.pruned} pruned, ${report.deltaTotal} total ` +
          `(${report.inBase}/${report.parsed} already in base)`
      );
      if (report.unmappedNames.length) {
        this.logger.warn(
          `Vanish delta: unmapped GameWith awoken names: ${report.unmappedNames.join(", ")}`
        );
      }
      return { ok: true, ...report };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Vanish delta refresh failed (community DB refresh kept): ${msg}`);
      return { ok: false, error: msg };
    }
  }
}
