/**
 * GameWith assist-vanish sync used by the admin "Refresh DB" job.
 *
 * The committed base DB (seed/gamewith-vanish.sqlite) is rebuilt by
 * scripts/import-gamewith-vanish-db.mjs at deploy time. Between deploys, the
 * refresh job writes assists that are missing from the base into a separate
 * delta DB. Readers prefer the base row; delta rows that later appear in the
 * base are pruned.
 *
 * Parsing mirrors scripts/import-gamewith-vanish-db.mjs — keep both in sync.
 */

export const VANISH_TABLE_NAME = "monster_vanish_awoken";

export const GW_ASSIST_MONSTERS_URL =
  "https://firebasestorage.googleapis.com/v0/b/walkthrough-tool.appspot.com/o/puzzdra%2Fmaster%2FassistMonsters.json?alt=media";
export const GW_AWAKENING_SKILLS_URL =
  "https://firebasestorage.googleapis.com/v0/b/walkthrough-tool.appspot.com/o/puzzdra%2Fmaster%2FawakeningSkills.json?alt=media";

const FETCH_TIMEOUT_MS = 60_000;

export type GwAssistMonster = {
  図鑑番号?: unknown;
  正式名称?: unknown;
  スキル内容生成?: unknown;
  skillAttributes?: { 覚醒付与スキル?: unknown } | null;
};

export type GwAwakeningSkill = { 名前?: unknown };

export type VanishRow = {
  monster_id: number;
  awoken_skill_ids: string;
  name_ja: string | null;
  skill_text: string;
};

export type BuildVanishRowsResult = {
  rows: VanishRow[];
  /** Assist monster ids that could not be parsed or mapped. */
  skippedIds: number[];
  /** GameWith awakening names with no awoken_skill_id mapping. */
  unmappedNames: string[];
};

/** Executes one SQL statement; returns result rows (empty for writes). */
export type SqlExec = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export type VanishDeltaSyncResult = {
  /** Assists with a granted-awakening skill parsed from GameWith. */
  parsed: number;
  /** Parsed assists already present in the base DB (left untouched). */
  inBase: number;
  inserted: number;
  updated: number;
  /** Delta rows removed because the base DB now has them. */
  pruned: number;
  deltaTotal: number;
};

export function vanishTableDdl(alias: string): string {
  return (
    `CREATE TABLE IF NOT EXISTS ${alias}.${VANISH_TABLE_NAME} (` +
    `monster_id INTEGER PRIMARY KEY NOT NULL, ` +
    `awoken_skill_ids TEXT NOT NULL, ` +
    `name_ja TEXT, ` +
    `skill_text TEXT, ` +
    `imported_at TEXT NOT NULL DEFAULT (datetime('now')))`
  );
}

/**
 * Row source for reads: base rows take precedence; delta rows only fill
 * monsters the base lacks. Returns null when neither DB is attached.
 */
export function vanishReadSourceSql(
  baseAlias: string | null,
  deltaAlias: string | null
): string | null {
  const base = baseAlias ? `${baseAlias}.${VANISH_TABLE_NAME}` : null;
  const delta = deltaAlias ? `${deltaAlias}.${VANISH_TABLE_NAME}` : null;
  if (base && delta) {
    return (
      `(SELECT monster_id, awoken_skill_ids FROM ${base} ` +
      `UNION ALL SELECT d.monster_id, d.awoken_skill_ids FROM ${delta} AS d ` +
      `WHERE NOT EXISTS (SELECT 1 FROM ${base} AS b WHERE b.monster_id = d.monster_id))`
    );
  }
  return base ?? delta;
}

/** Normalize JP awakening names for lookup (+/＋, optional ・, whitespace). */
export function normalizeAwokenName(name: unknown): string {
  return String(name).replace(/\+/g, "＋").replace(/・/g, "").trim();
}

/**
 * name_ja → awoken_skill_id from the working DB `awoken_skills` rows, with
 * manual overrides (seed/vanish-awoken-name-map.json) applied on top.
 */
export function buildAwokenNameIndex(
  dbRows: readonly { awoken_skill_id: unknown; name_ja: unknown }[],
  manualMap: Readonly<Record<string, unknown>>
): Map<string, number> {
  const byName = new Map<string, number>();
  for (const row of dbRows) {
    const raw = typeof row.name_ja === "string" ? row.name_ja : "";
    if (!raw || raw === "Untranslated" || raw === "???") continue;
    const id = Number(row.awoken_skill_id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const key = normalizeAwokenName(raw);
    const existing = byName.get(key);
    if (existing != null && existing !== id) {
      throw new Error(`Duplicate awoken_skills.name_ja after normalize: "${key}"`);
    }
    byName.set(key, id);
  }
  for (const [rawKey, rawValue] of Object.entries(manualMap)) {
    if (rawKey.startsWith("_")) continue;
    if (rawValue == null || rawValue === "") continue;
    const id = Number(rawValue);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(
        `Vanish name map: "${rawKey}" must be a positive integer awoken_skill_id (got ${String(rawValue)})`
      );
    }
    byName.set(normalizeAwokenName(rawKey), id);
  }
  return byName;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Awakening names granted by a GameWith skill text (segment before を付与). */
export function parseGrantedAwokenNames(
  text: string,
  sortedNames: readonly string[]
): string[] {
  const match = text.match(/([\s\S]*?)を付与/);
  if (!match || !sortedNames.length) return [];
  const segment = match[1].replace(/<br\s*\/?>/gi, "");
  const regex = new RegExp(sortedNames.map(escapeRegExp).join("|"), "g");
  return [...segment.matchAll(regex)].map((m) => m[0]);
}

export function buildVanishRows(
  assistMonsters: readonly GwAssistMonster[],
  gwAwakenings: readonly GwAwakeningSkill[],
  nameIndex: ReadonlyMap<string, number>
): BuildVanishRowsResult {
  const sortedNames = gwAwakenings
    .map((a) => (typeof a.名前 === "string" ? a.名前 : ""))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const rows: VanishRow[] = [];
  const skippedIds: number[] = [];
  const unmapped = new Set<string>();

  for (const monster of assistMonsters) {
    if (monster.skillAttributes?.覚醒付与スキル !== true) continue;
    if (monster.図鑑番号 == null) continue;
    const monsterId = Number(monster.図鑑番号);
    if (!Number.isInteger(monsterId) || monsterId <= 0) continue;

    const skillText = String(monster.スキル内容生成 ?? "");
    const names = parseGrantedAwokenNames(skillText, sortedNames);
    if (!names.length) {
      skippedIds.push(monsterId);
      continue;
    }

    const ids: number[] = [];
    let missing = false;
    for (const name of names) {
      const id = nameIndex.get(normalizeAwokenName(name));
      if (id == null) {
        unmapped.add(name);
        missing = true;
      } else {
        ids.push(id);
      }
    }
    if (missing) {
      skippedIds.push(monsterId);
      continue;
    }

    rows.push({
      monster_id: monsterId,
      awoken_skill_ids: JSON.stringify(ids),
      name_ja: typeof monster.正式名称 === "string" ? monster.正式名称 : null,
      skill_text: skillText.replace(/<br\s*\/?>/gi, "\n"),
    });
  }

  return {
    rows,
    skippedIds,
    unmappedNames: [...unmapped].sort(),
  };
}

async function fetchJsonArray(url: string, label: string): Promise<unknown[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "pad-searching-tool/1.0" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`GameWith ${label} fetch failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) {
    throw new Error(`Unexpected GameWith ${label} JSON shape (expected an array).`);
  }
  return body;
}

export async function fetchGameWithVanishMaster(): Promise<{
  assistMonsters: GwAssistMonster[];
  awakenings: GwAwakeningSkill[];
}> {
  const [assistMonsters, awakenings] = await Promise.all([
    fetchJsonArray(GW_ASSIST_MONSTERS_URL, "assistMonsters"),
    fetchJsonArray(GW_AWAKENING_SKILLS_URL, "awakeningSkills"),
  ]);
  return {
    assistMonsters: assistMonsters as GwAssistMonster[],
    awakenings: awakenings as GwAwakeningSkill[],
  };
}

function monsterIdSet(rows: unknown[]): Set<number> {
  const ids = new Set<number>();
  for (const row of rows) {
    const id = Number((row as { monster_id?: unknown }).monster_id);
    if (Number.isInteger(id)) ids.add(id);
  }
  return ids;
}

/** Delete delta rows whose monster now exists in the base DB. Returns rows removed. */
export async function pruneVanishDelta(
  exec: SqlExec,
  baseAlias: string,
  deltaAlias: string
): Promise<number> {
  const dupes = await exec(
    `SELECT d.monster_id FROM ${deltaAlias}.${VANISH_TABLE_NAME} AS d ` +
      `WHERE EXISTS (SELECT 1 FROM ${baseAlias}.${VANISH_TABLE_NAME} AS b ` +
      `WHERE b.monster_id = d.monster_id)`
  );
  if (!dupes.length) return 0;
  await exec(
    `DELETE FROM ${deltaAlias}.${VANISH_TABLE_NAME} WHERE monster_id IN ` +
      `(SELECT monster_id FROM ${baseAlias}.${VANISH_TABLE_NAME})`
  );
  return dupes.length;
}

/**
 * Write parsed rows missing from the base DB into the delta DB (insert or
 * update when the grant list / text changed), then prune delta rows the base
 * already covers. `baseAlias` null means no base DB is attached.
 */
export async function syncVanishDeltaRows(
  exec: SqlExec,
  opts: { baseAlias: string | null; deltaAlias: string; rows: readonly VanishRow[] }
): Promise<VanishDeltaSyncResult> {
  const { baseAlias, deltaAlias, rows } = opts;
  const table = `${deltaAlias}.${VANISH_TABLE_NAME}`;

  const baseIds = baseAlias
    ? monsterIdSet(await exec(`SELECT monster_id FROM ${baseAlias}.${VANISH_TABLE_NAME}`))
    : new Set<number>();

  const existing = new Map<number, { awoken_skill_ids: unknown; name_ja: unknown; skill_text: unknown }>();
  for (const row of await exec(
    `SELECT monster_id, awoken_skill_ids, name_ja, skill_text FROM ${table}`
  )) {
    const r = row as {
      monster_id: unknown;
      awoken_skill_ids: unknown;
      name_ja: unknown;
      skill_text: unknown;
    };
    existing.set(Number(r.monster_id), r);
  }

  let inBase = 0;
  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    if (baseIds.has(row.monster_id)) {
      inBase++;
      continue;
    }
    const prev = existing.get(row.monster_id);
    if (!prev) {
      await exec(
        `INSERT INTO ${table} (monster_id, awoken_skill_ids, name_ja, skill_text) ` +
          `VALUES (?, ?, ?, ?)`,
        [row.monster_id, row.awoken_skill_ids, row.name_ja, row.skill_text]
      );
      // GameWith may list a monster twice: later rows update instead of re-inserting.
      existing.set(row.monster_id, row);
      inserted++;
      continue;
    }
    if (
      prev.awoken_skill_ids === row.awoken_skill_ids &&
      (prev.name_ja ?? null) === row.name_ja &&
      prev.skill_text === row.skill_text
    ) {
      continue;
    }
    await exec(
      `UPDATE ${table} SET awoken_skill_ids = ?, name_ja = ?, skill_text = ?, ` +
        `imported_at = datetime('now') WHERE monster_id = ?`,
      [row.awoken_skill_ids, row.name_ja, row.skill_text, row.monster_id]
    );
    existing.set(row.monster_id, row);
    updated++;
  }

  const pruned = baseAlias ? await pruneVanishDelta(exec, baseAlias, deltaAlias) : 0;
  const totalRows = (await exec(`SELECT COUNT(*) AS cnt FROM ${table}`)) as {
    cnt: unknown;
  }[];

  return {
    parsed: rows.length,
    inBase,
    inserted,
    updated,
    pruned,
    deltaTotal: Number(totalRows[0]?.cnt ?? 0),
  };
}
