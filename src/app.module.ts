import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PadCategorized } from "./entities/pad-categorized.entity";
import { TransformModule } from "./transform/transform.module";

const sqlitePath = process.env.SQLITE_PATH ?? "./pad.db";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "better-sqlite3",
      database: sqlitePath,
      entities: [PadCategorized],
      synchronize: process.env.TYPEORM_SYNC !== "false",
      logging: process.env.TYPEORM_LOGGING === "true",
    }),
    TransformModule,
  ],
})
export class AppModule {}
