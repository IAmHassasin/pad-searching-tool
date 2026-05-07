import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PadCategorized } from "../entities/pad-categorized.entity";
import { TransformService } from "./transform.service";

@Module({
  imports: [TypeOrmModule.forFeature([PadCategorized])],
  providers: [TransformService],
  exports: [TransformService],
})
export class TransformModule {}
