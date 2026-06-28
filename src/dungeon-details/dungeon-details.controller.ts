import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
} from "@nestjs/common";
import { DungeonDetailsService } from "./dungeon-details.service";

@Controller("api/dungeon-details")
export class DungeonDetailsController {
  constructor(private readonly dungeons: DungeonDetailsService) {}

  @Get()
  list() {
    return this.dungeons.listDungeons();
  }

  @Get("translations/en")
  translationsEn() {
    return this.dungeons.getEnglishTranslations();
  }

  @Get(":postId")
  async get(@Param("postId", ParseIntPipe) postId: number) {
    try {
      return await this.dungeons.getDungeon(postId);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException(`Dungeon ${postId} not found`);
    }
  }
}
