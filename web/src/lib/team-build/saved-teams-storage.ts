import {
  sanitizeTeamBuildConfig,
  type StorageLike,
} from "./team-draft-storage.ts";
import type { TeamBuildConfig } from "./types.ts";

/**
 * Named teams the user keeps in this browser (separate from the working draft, which
 * the team build page edits live). Each entry stores a full config snapshot.
 */
export const SAVED_TEAMS_STORAGE_KEY = "pst.team-build.saved.v1";
/** Keeps localStorage use bounded (one entry is ~2 KB). */
export const MAX_SAVED_TEAMS = 100;
export const MAX_TEAM_NAME_LENGTH = 60;

export type SavedTeam = {
  id: string;
  name: string;
  /** ISO timestamp of the last save. */
  savedAt: string;
  config: TeamBuildConfig;
};

export type SaveTeamResult =
  | { ok: true; teams: SavedTeam[]; team: SavedTeam; replaced: boolean }
  | { ok: false; teams: SavedTeam[]; error: "empty-name" | "limit" | "storage" };

function defaultStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeTeamName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_TEAM_NAME_LENGTH);
}

/** Names match ignoring letter case only (kana / width / accents stay distinct). */
function nameKey(name: string): string {
  return normalizeTeamName(name).normalize("NFC").toLowerCase();
}

/** The saved team a save under `name` would replace, if any. */
export function findSavedTeamByName(teams: readonly SavedTeam[], name: string): SavedTeam | null {
  const key = nameKey(name);
  if (!key) return null;
  return teams.find((t) => nameKey(t.name) === key) ?? null;
}

function sanitizeSavedTeam(raw: unknown): SavedTeam | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? normalizeTeamName(r.name) : "";
  if (typeof r.id !== "string" || !r.id || !name) return null;
  const savedAt =
    typeof r.savedAt === "string" && !Number.isNaN(Date.parse(r.savedAt))
      ? r.savedAt
      : new Date(0).toISOString();
  return { id: r.id, name, savedAt, config: sanitizeTeamBuildConfig(r.config) };
}

/** Newest first. */
function sortTeams(teams: SavedTeam[]): SavedTeam[] {
  return [...teams].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function loadSavedTeams(storage: StorageLike | null = defaultStorage()): SavedTeam[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SAVED_TEAMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const teams: SavedTeam[] = [];
    for (const item of parsed) {
      const team = sanitizeSavedTeam(item);
      if (!team || seen.has(team.id)) continue;
      seen.add(team.id);
      teams.push(team);
    }
    return sortTeams(teams);
  } catch {
    return [];
  }
}

function writeTeams(teams: SavedTeam[], storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVED_TEAMS_STORAGE_KEY, JSON.stringify(teams));
    return true;
  } catch {
    return false;
  }
}

function newId(now: Date): string {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${now.getTime().toString(36)}-${rand}`;
}

/** Save a snapshot under `name`; an existing team with the same name is replaced. */
export function saveTeam(
  name: string,
  config: TeamBuildConfig,
  storage: StorageLike | null = defaultStorage(),
  now: Date = new Date()
): SaveTeamResult {
  const teams = loadSavedTeams(storage);
  const clean = normalizeTeamName(name);
  if (!clean) return { ok: false, teams, error: "empty-name" };
  const existing = findSavedTeamByName(teams, clean);
  if (!existing && teams.length >= MAX_SAVED_TEAMS) {
    return { ok: false, teams, error: "limit" };
  }
  const team: SavedTeam = {
    id: existing?.id ?? newId(now),
    name: clean,
    savedAt: now.toISOString(),
    // Snapshot through the sanitizer: a plain JSON copy, independent of the live draft.
    config: sanitizeTeamBuildConfig(JSON.parse(JSON.stringify(config))),
  };
  const next = sortTeams([team, ...teams.filter((t) => t.id !== team.id)]);
  if (!writeTeams(next, storage)) return { ok: false, teams, error: "storage" };
  return { ok: true, teams: next, team, replaced: existing != null };
}

export function deleteSavedTeam(
  id: string,
  storage: StorageLike | null = defaultStorage()
): { ok: boolean; teams: SavedTeam[] } {
  const teams = loadSavedTeams(storage);
  const next = teams.filter((t) => t.id !== id);
  if (next.length === teams.length) return { ok: false, teams };
  if (!writeTeams(next, storage)) return { ok: false, teams };
  return { ok: true, teams: next };
}

/** Fires when another tab writes the saved list. Returns the unsubscribe function. */
export function subscribeSavedTeams(onChange: (teams: SavedTeam[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key !== null && e.key !== SAVED_TEAMS_STORAGE_KEY) return;
    onChange(loadSavedTeams());
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
