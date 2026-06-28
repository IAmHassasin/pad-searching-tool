import { Module } from "@nestjs/common";
import { ApiModule } from "../api/api.module";
import { DungeonDetailsController } from "./dungeon-details.controller";
import { DungeonDetailsService } from "./dungeon-details.service";

@Module({
  imports: [ApiModule],
  controllers: [DungeonDetailsController],
  providers: [DungeonDetailsService],
})
export class DungeonDetailsModule {}
