import { Controller, Get } from "@nestjs/common";
import { EggMachinesService } from "./egg-machines.service";

@Controller("api/egg-machines")
export class EggMachinesController {
  constructor(private readonly eggMachines: EggMachinesService) {}

  @Get()
  list() {
    return this.eggMachines.list();
  }
}
