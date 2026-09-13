import { Module } from "@nestjs/common";
import { ApiModule } from "../api/api.module";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { AdminController } from "./admin.controller";
import { AdminJobLock } from "./admin-job-lock";
import { AdminRefreshService } from "./admin-refresh.service";
import { DungeonCatalogSyncService } from "./dungeon-catalog-sync.service";
import { EventCatalogSyncService } from "./event-catalog-sync.service";

@Module({
  imports: [ApiModule],
  controllers: [AdminController],
  providers: [
    AdminAuthService,
    AdminAuthGuard,
    AdminJobLock,
    AdminRefreshService,
    DungeonCatalogSyncService,
    EventCatalogSyncService,
  ],
})
export class AdminModule {}
