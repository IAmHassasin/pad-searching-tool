import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PadCategorized } from "../entities/pad-categorized.entity";
import { AwokenSkillsService } from "./awoken-skills.service";
import { PadsApiController } from "./pads-api.controller";
import { SourceRowsService } from "./source-rows.service";

@Module({
  imports: [TypeOrmModule.forFeature([PadCategorized])],
  controllers: [PadsApiController],
  providers: [SourceRowsService, AwokenSkillsService],
})
export class ApiModule {}
