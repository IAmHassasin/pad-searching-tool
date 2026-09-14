import {
  serializeAdvancedEffectFilters,
  type AdvancedEffectFilters,
  type CollabGroupResponse,
  type EffectFamiliesManifest,
  type EvoTreeResponse,
  type MonsterFilters,
  type MonsterRecord,
  type MonsterSearchResponse,
  type PatternGroupsManifest,
  type SkillFilters,
} from "./types";
import { nextSearchPage, type SearchSnapshot } from "./lib/search-paging";

export type { SearchSnapshot };

const base = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(
  /\/$/,
  ""
) ?? "";

async function parseError(res: Response, path: string): Promise<never> {
  const body = await res.text().catch(() => "");
  let message = `${res.status} ${res.statusText}: ${path}`;
  if (body) {
    try {
      const json = JSON.parse(body) as { message?: string | string[] };
      const m = json.message;
      if (typeof m === "string") message = m;
      else if (Array.isArray(m)) message = m.join(", ");
      else message += ` — ${body.slice(0, 200)}`;
    } catch {
      message += ` — ${body.slice(0, 200)}`;
    }
  }
  throw new Error(message);
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, init);
  if (!res.ok) await parseError(res, path);
  return res.json() as Promise<T>;
}

export function getAdminToken(storageKey: string): string | null {
  try {
    return sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function setAdminToken(storageKey: string, token: string): void {
  sessionStorage.setItem(storageKey, token);
}

export function clearAdminToken(storageKey: string): void {
  sessionStorage.removeItem(storageKey);
}

export function adminLogin(username: string, password: string) {
  return getJson<{ token: string; expiresAt: string }>("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export function adminSession(token: string) {
  return getJson<{ ok: boolean; username: string; role: "superadmin" }>(
    "/admin/session",
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export function adminRefreshDb(token: string) {
  return getJson<{
    ok: true;
    finishedAt: string;
    import: {
      mode: string;
      sqlitePath: string;
      downloadUrl: string;
      tablesReplaced: string[];
      tablesSkipped: string[];
      tablesCreated: string[];
    };
  }>("/admin/refresh-db", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function adminRefreshDungeons(token: string) {
  return getJson<{
    ok: true;
    finishedAt: string;
    added: number[];
    failed: Array<{ id: number; error: string }>;
    candidateCount: number;
  }>("/admin/refresh-dungeons", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function adminRefreshEvents(token: string) {
  return getJson<{
    ok: true;
    finishedAt: string;
    created: string[];
    skippedExisting: string[];
    unparsedArticles: number;
  }>("/admin/refresh-events", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function adminDeleteEvent(token: string, eventId: string) {
  return getJson<{ ok: true; deleted: string }>(
    `/admin/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

export function adminDeleteDungeon(token: string, postId: number) {
  return getJson<{ ok: true; deleted: number }>(`/admin/dungeons/${postId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchHealth() {
  return getJson<{ ok: boolean }>("/health");
}

export function fetchPatternGroups() {
  return getJson<PatternGroupsManifest>("/patterns/groups");
}

export function fetchEffectFamilies() {
  return getJson<EffectFamiliesManifest>("/patterns/effect-families");
}

function setCsv(q: URLSearchParams, key: string, values: number[] | string[]) {
  if (values.length) q.set(key, values.join(","));
}

function monsterParams(q: URLSearchParams, f: MonsterFilters) {
  setCsv(q, "rarity", [...f.rarity]);
  f.attributeSlots.forEach((slot, index) => {
    setCsv(q, `attributeSlot${index + 1}`, [...slot]);
  });
  if (f.attributeSlots.some((slot) => slot.size > 0)) {
    q.set("attributeMatch", f.attributeMatch);
  }
  setCsv(q, "types", [...f.types]);
  if (f.hpMin != null) q.set("hpMin", String(f.hpMin));
  if (f.hpMax != null) q.set("hpMax", String(f.hpMax));
  if (f.atkMin != null) q.set("atkMin", String(f.atkMin));
  if (f.atkMax != null) q.set("atkMax", String(f.atkMax));
  if (f.rcvMin != null) q.set("rcvMin", String(f.rcvMin));
  if (f.rcvMax != null) q.set("rcvMax", String(f.rcvMax));
  if (f.idQuery.trim()) q.set("idQuery", f.idQuery.trim());
  setCsv(q, "awakeningIds", f.awakeningIds);
  if (f.awakeningIds.length > 0) q.set("awakeningMatch", "all");
  setCsv(q, "excludedAwakeningIds", f.excludedAwakeningIds);
  if (f.vanishOnly) q.set("vanishOnly", "1");
  setCsv(q, "vanishAwakeningIds", f.vanishAwakeningIds);
  if (f.vanishAwakeningIds.length > 0) q.set("vanishAwakeningMatch", "all");
}

function skillParams(q: URLSearchParams, f: SkillFilters) {
  const activeTags = f.selectedPatterns
    .filter((p) => p.skillType === "active_skill")
    .map((p) => p.tagKey);
  const leaderTags = f.selectedPatterns
    .filter((p) => p.skillType === "leader_skill")
    .map((p) => p.tagKey);
  setCsv(q, "activeTags", activeTags);
  setCsv(q, "leaderTags", leaderTags);
  q.set("patternMatch", f.patternMatch);
  q.set("skillTextMode", f.skillTextMode);
  if (f.activeSkillText.trim()) q.set("activeSkillText", f.activeSkillText.trim());
  if (f.leaderSkillText.trim()) q.set("leaderSkillText", f.leaderSkillText.trim());
}

export async function searchMonstersPage(
  monsterFilters: MonsterFilters,
  skillFilters: SkillFilters,
  limit: number,
  offset: number,
  advancedEffectFilters?: AdvancedEffectFilters,
  skipCount = false
): Promise<MonsterSearchResponse> {
  const q = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  monsterParams(q, monsterFilters);
  skillParams(q, skillFilters);
  if (advancedEffectFilters) {
    const effect = serializeAdvancedEffectFilters(advancedEffectFilters);
    if (effect) q.set("effect", effect);
  }
  if (skipCount) q.set("skipCount", "1");
  return getJson<MonsterSearchResponse>(`/monsters/search?${q}`);
}

export async function searchAllMonsters(
  monsterFilters: MonsterFilters,
  skillFilters: SkillFilters,
  onProgress?: (snapshot: SearchSnapshot) => void,
  advancedEffectFilters?: AdvancedEffectFilters
): Promise<SearchSnapshot> {
  const all: MonsterRecord[] = [];
  let total = Number.POSITIVE_INFINITY;
  let minMonsterId = 0;
  let modernOnly = false;
  for (;;) {
    const req = nextSearchPage(all.length, total);
    if (!req) break;
    const page = await searchMonstersPage(
      monsterFilters,
      skillFilters,
      req.limit,
      req.offset,
      advancedEffectFilters,
      req.skipCount
    );
    if (!req.skipCount) {
      total = page.total;
    }
    minMonsterId = page.minMonsterId ?? minMonsterId;
    modernOnly = page.modernOnly === true;
    all.push(...page.rows);
    const knownTotal = Number.isFinite(total) ? total : all.length;
    onProgress?.({
      rows: all.slice(),
      total: knownTotal,
      minMonsterId,
      modernOnly,
    });
    if (page.rows.length < req.limit) break;
  }
  if (!Number.isFinite(total)) total = all.length;
  return { rows: all, total, minMonsterId, modernOnly };
}

export function fetchMonstersByIds(ids: number[]) {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (!unique.length) {
    return Promise.resolve({ rows: [] as MonsterRecord[] });
  }
  return getJson<{ rows: MonsterRecord[] }>(
    `/monsters/lookup?ids=${encodeURIComponent(unique.join(","))}`
  );
}

export function fetchEvoTree(monsterId: number) {
  return getJson<EvoTreeResponse>(
    `/monsters/evo-tree?monsterId=${encodeURIComponent(String(monsterId))}`
  );
}

export function fetchCollabGroup(monsterId: number) {
  return getJson<CollabGroupResponse>(
    `/monsters/collab-group?monsterId=${encodeURIComponent(String(monsterId))}`
  );
}
