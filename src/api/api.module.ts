import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PadCategorized } from "../entities/pad-categorized.entity";
import { PatternCatalogService } from "../patterns/pattern-catalog.service";
import { AwokenSkillsService } from "./awoken-skills.service";
import { CategoryBundlesController } from "./category-bundles.controller";
import { CategoryBundlesService } from "./category-bundles.service";
import { FilterCategoriesService } from "./filter-categories.service";
import { MonsterRelationsService } from "./monster-relations.service";
import { PatternSearchService } from "./pattern-search.service";
import { PatternsController } from "./patterns.controller";
import { PadsApiController } from "./pads-api.controller";
import { SourceRowsService } from "./source-rows.service";
import { VanishAwokenService } from "./vanish-awoken.service";

@Module({
  imports: [TypeOrmModule.forFeature([PadCategorized])],
  controllers: [PadsApiController, CategoryBundlesController, PatternsController],
  providers: [
    PatternCatalogService,
    PatternSearchService,
    MonsterRelationsService,
    SourceRowsService,
    AwokenSkillsService,
    CategoryBundlesService,
    FilterCategoriesService,
    VanishAwokenService,
  ],
  exports: [MonsterRelationsService],
})
export class ApiModule {}
