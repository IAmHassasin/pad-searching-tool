import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { AdminRefreshService } from "./admin-refresh.service";

type LoginBody = { username?: string; password?: string };

@Controller("admin")
export class AdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly refresh: AdminRefreshService
  ) {}

  @Get("config")
  config(): { enabled: boolean } {
    try {
      this.auth.assertAdminConfigured();
      return { enabled: true };
    } catch {
      return { enabled: false };
    }
  }

  @Post("login")
  login(@Body() body: LoginBody) {
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";
    this.auth.assertAdminConfigured();
    if (!username || !password) {
      throw new BadRequestException("username and password are required");
    }
    return this.auth.login(username, password);
  }

  @Get("session")
  @UseGuards(AdminAuthGuard)
  session(@Req() req: { adminUser: { username: string } }) {
    return {
      ok: true,
      username: req.adminUser.username,
      role: "superadmin" as const,
    };
  }

  @Post("refresh-db")
  @UseGuards(AdminAuthGuard)
  async refreshDb() {
    return this.refresh.refreshCommunityDb();
  }

  @Get("refresh-status")
  @UseGuards(AdminAuthGuard)
  refreshStatus() {
    return { refreshing: this.refresh.isRefreshing() };
  }
}
