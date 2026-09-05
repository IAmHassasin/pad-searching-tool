import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PadCategorized } from "../entities/pad-categorized.entity";
import { EffectValueCatalogService } from "../patterns/effect-value-catalog.service";
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
import { VoidSuperGravityService } from "./void-super-gravity.service";

@Module({
  imports: [TypeOrmModule.forFeature([PadCategorized])],
  controllers: [PadsApiController, CategoryBundlesController, PatternsController],
  providers: [
    PatternCatalogService,
    EffectValueCatalogService,
    PatternSearchService,
    MonsterRelationsService,
    SourceRowsService,
    AwokenSkillsService,
    CategoryBundlesService,
    FilterCategoriesService,
    VanishAwokenService,
    VoidSuperGravityService,
  ],
  exports: [MonsterRelationsService, VanishAwokenService, VoidSuperGravityService],
})
export class ApiModule {}
