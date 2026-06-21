import type {
  MonsterFilters,
  MonsterRecord,
  MonsterSearchResponse,
  PatternGroupsManifest,
  SkillFilters,
} from "./types";

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

export function fetchHealth() {
  return getJson<{ ok: boolean }>("/health");
}

export function fetchPatternGroups() {
  return getJson<PatternGroupsManifest>("/patterns/groups");
}

function setCsv(q: URLSearchParams, key: string, values: number[] | string[]) {
  if (values.length) q.set(key, values.join(","));
}

function monsterParams(q: URLSearchParams, f: MonsterFilters) {
  setCsv(q, "rarity", [...f.rarity]);
  setCsv(q, "attributes", [...f.attributes]);
  if (f.hpMin != null) q.set("hpMin", String(f.hpMin));
  if (f.hpMax != null) q.set("hpMax", String(f.hpMax));
  if (f.atkMin != null) q.set("atkMin", String(f.atkMin));
  if (f.atkMax != null) q.set("atkMax", String(f.atkMax));
  if (f.rcvMin != null) q.set("rcvMin", String(f.rcvMin));
  if (f.rcvMax != null) q.set("rcvMax", String(f.rcvMax));
  if (f.idQuery.trim()) q.set("idQuery", f.idQuery.trim());
  setCsv(q, "awakeningIds", f.awakeningIds);
  if (f.awakeningIds.length > 0) q.set("awakeningMatch", f.awakeningMatch);
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
  offset: number
): Promise<MonsterSearchResponse> {
  const q = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  monsterParams(q, monsterFilters);
  skillParams(q, skillFilters);
  return getJson<MonsterSearchResponse>(`/monsters/search?${q}`);
}

export async function searchAllMonsters(
  monsterFilters: MonsterFilters,
  skillFilters: SkillFilters,
  onProgress?: (loaded: number, total: number) => void
): Promise<{ rows: MonsterRecord[]; total: number }> {
  const limit = 5000;
  const all: MonsterRecord[] = [];
  let offset = 0;
  let total = 0;
  for (;;) {
    const page = await searchMonstersPage(
      monsterFilters,
      skillFilters,
      limit,
      offset
    );
    total = page.total;
    all.push(...page.rows);
    onProgress?.(all.length, total);
    if (page.rows.length < limit || all.length >= total) break;
    offset += limit;
  }
  return { rows: all, total };
}
