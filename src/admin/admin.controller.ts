import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { DungeonCatalogSyncService } from "./dungeon-catalog-sync.service";
import { EventCatalogSyncService } from "./event-catalog-sync.service";
import { AdminRefreshService } from "./admin-refresh.service";

type LoginBody = { username?: string; password?: string };

@Controller("admin")
export class AdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly refresh: AdminRefreshService,
    private readonly dungeons: DungeonCatalogSyncService,
    private readonly events: EventCatalogSyncService
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

  @Post("refresh-dungeons")
  @UseGuards(AdminAuthGuard)
  async refreshDungeons() {
    return this.dungeons.refreshDungeons();
  }

  @Post("refresh-events")
  @UseGuards(AdminAuthGuard)
  async refreshEvents() {
    return this.events.refreshEvents();
  }

  @Delete("events/:eventId")
  @UseGuards(AdminAuthGuard)
  deleteEvent(@Param("eventId") eventId: string) {
    return this.events.deleteEvent(eventId);
  }

  @Delete("dungeons/:postId")
  @UseGuards(AdminAuthGuard)
  deleteDungeon(@Param("postId", ParseIntPipe) postId: number) {
    return this.dungeons.deleteDungeon(postId);
  }

  @Get("refresh-status")
  @UseGuards(AdminAuthGuard)
  refreshStatus() {
    return { refreshing: this.refresh.isRefreshing() };
  }
}
