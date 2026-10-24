import { fetchMonstersByIds } from "../api";
import type { MonsterRecord } from "../types";
import type { EggMachineList } from "./types";

const base =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ??
  "";

const LOOKUP_CHUNK = 50;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export function fetchEggMachines() {
  return getJson<EggMachineList>("/api/egg-machines");
}

export async function fetchMonsterRecords(ids: number[]): Promise<MonsterRecord[]> {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  const rows: MonsterRecord[] = [];
  for (let offset = 0; offset < unique.length; offset += LOOKUP_CHUNK) {
    const chunk = unique.slice(offset, offset + LOOKUP_CHUNK);
    const page = await fetchMonstersByIds(chunk);
    rows.push(...page.rows);
  }
  return rows;
}
