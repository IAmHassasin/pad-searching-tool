import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { NameTranslationService } from "../api/name-translation.service";
import {
  classifyEggMachines,
  EGG_MACHINES_SINCE_UNIX,
  type EggMachineEvent,
  type EggMachineInput,
} from "./classify-egg-machines";
import { ratesFromContents } from "./egg-rates";

type EggRow = {
  server_id: number;
  name: string | null;
  start_timestamp: number;
  end_timestamp: number;
  cost: number | null;
  machine_type: number;
  contents: string | null;
};

function monsterIdsFromContents(contents: string | null): number[] {
  if (!contents) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const ids: number[] = [];
  for (const key of Object.keys(parsed as Record<string, unknown>)) {
    const id = Number(String(key).replace(/[()]/g, ""));
    if (Number.isInteger(id) && id > 0) ids.push(id);
  }
  return ids;
}

@Injectable()
export class EggMachinesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly names: NameTranslationService
  ) {}

  async list(): Promise<{ events: EggMachineEvent[] }> {
    const rows = (await this.dataSource.query(
      `SELECT server_id, name, start_timestamp, end_timestamp, cost, machine_type, contents
       FROM egg_machines
       WHERE server_id IN (0, 1)
         AND machine_type NOT IN (1, 2, 9)`
    )) as EggRow[];

    const machines: EggMachineInput[] = rows.map((row) => ({
      serverId: Number(row.server_id),
      name: row.name?.trim() || "Egg Machine",
      start: Number(row.start_timestamp),
      end: Number(row.end_timestamp),
      cost: Number(row.cost ?? 0),
      machineType: Number(row.machine_type),
      monsterIds: monsterIdsFromContents(row.contents),
      rates: ratesFromContents(row.contents),
    }));

    const monsterIds = machines.flatMap((machine) => machine.monsterIds);
    const [onNa, collabIds] = await Promise.all([
      this.loadOnNa(monsterIds),
      this.loadCollabIds(monsterIds),
    ]);
    const events = classifyEggMachines(
      machines,
      onNa,
      Math.floor(Date.now() / 1000),
      EGG_MACHINES_SINCE_UNIX,
      collabIds
    );
    const names = await this.names.translateLabels(events.map((event) => event.name));
    return {
      events: events.map((event, index) => ({
        ...event,
        name: names[index] ?? event.name,
      })),
    };
  }

  private async loadCollabIds(monsterIds: number[]): Promise<Set<number>> {
    const unique = [...new Set(monsterIds)];
    const collab = new Set<number>();
    const chunkSize = 400;
    for (let offset = 0; offset < unique.length; offset += chunkSize) {
      const chunk = unique.slice(offset, offset + chunkSize);
      const placeholders = chunk.map(() => "?").join(", ");
      const rows = (await this.dataSource.query(
        `SELECT DISTINCT ms.monster_id AS monster_id
         FROM monster_series ms
         JOIN series s ON s.series_id = ms.series_id
         WHERE s.series_type IN ('collab', 'ghcollab')
           AND ms.monster_id IN (${placeholders})`,
        chunk
      )) as Array<{ monster_id: number }>;
      for (const row of rows) collab.add(Number(row.monster_id));
    }
    return collab;
  }

  private async loadOnNa(monsterIds: number[]): Promise<Set<number>> {
    const unique = [...new Set(monsterIds)];
    const onNa = new Set<number>();
    const chunkSize = 400;
    for (let offset = 0; offset < unique.length; offset += chunkSize) {
      const chunk = unique.slice(offset, offset + chunkSize);
      const placeholders = chunk.map(() => "?").join(", ");
      const rows = (await this.dataSource.query(
        `SELECT monster_id, on_na FROM monsters WHERE monster_id IN (${placeholders})`,
        chunk
      )) as Array<{ monster_id: number; on_na: number | null }>;
      for (const row of rows) {
        if (Number(row.on_na) === 1) onNa.add(Number(row.monster_id));
      }
    }
    return onNa;
  }
}
