import { Module } from "@nestjs/common";
import { ApiModule } from "../api/api.module";
import { EventController } from "./event.controller";
import { EventService } from "./event.service";

@Module({
  imports: [ApiModule],
  controllers: [EventController],
  providers: [EventService],
})
export class EventModule {}
