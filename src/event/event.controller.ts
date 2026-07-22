import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { EventService } from "./event.service";

@Controller("api/events")
export class EventController {
  constructor(private readonly events: EventService) {}

  @Get()
  list() {
    return this.events.listEvents();
  }

  @Get(":eventId")
  async get(@Param("eventId") eventId: string) {
    try {
      return await this.events.getEvent(eventId);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException(`Event ${eventId} not found`);
    }
  }
}
