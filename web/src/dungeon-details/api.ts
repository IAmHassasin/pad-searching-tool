import type { DungeonListResponse, DungeonRecord } from "./types";

const base =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ??
  "";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export function fetchDungeonList() {
  return getJson<DungeonListResponse>("/api/dungeon-details");
}

export function fetchDungeon(postId: number | string) {
  return getJson<DungeonRecord>(`/api/dungeon-details/${postId}`);
}

export function fetchEnglishTranslations() {
  return getJson<EnglishGlossary>("/api/dungeon-details/translations/en");
}

export type EnglishGlossary = {
  titles?: Record<string, string>;
  gimmicks: Record<string, string>;
  types: Record<string, string>;
  spawnNotes: Record<string, string>;
  partLabels: Record<string, string>;
  tags: Record<string, string>;
  phrases: [string, string][];
};
