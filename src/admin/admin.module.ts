import { Module } from "@nestjs/common";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { AdminController } from "./admin.controller";
import { AdminRefreshService } from "./admin-refresh.service";

@Module({
  controllers: [AdminController],
  providers: [AdminAuthService, AdminAuthGuard, AdminRefreshService],
})
export class AdminModule {}
