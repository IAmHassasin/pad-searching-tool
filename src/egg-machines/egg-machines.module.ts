import { Module } from "@nestjs/common";
import { ApiModule } from "../api/api.module";
import { EggMachinesController } from "./egg-machines.controller";
import { EggMachinesService } from "./egg-machines.service";

@Module({
  imports: [ApiModule],
  controllers: [EggMachinesController],
  providers: [EggMachinesService],
})
export class EggMachinesModule {}
