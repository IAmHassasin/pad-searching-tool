import { Module } from "@nestjs/common";
import { ApiModule } from "../api/api.module";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { AdminController } from "./admin.controller";
import { AdminRefreshService } from "./admin-refresh.service";

@Module({
  imports: [ApiModule],
  controllers: [AdminController],
  providers: [AdminAuthService, AdminAuthGuard, AdminRefreshService],
})
export class AdminModule {}
