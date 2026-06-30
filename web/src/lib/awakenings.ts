/** Assist Resonance — activates with matching-color/type assist equipment. */
export const ASSIST_RESONANCE_AWAKENING_ID = 138;

/** Parse dadguide awakening id lists, e.g. `(52),(56)` or `(52),(56)| (56),(111)`. */
export function parseAwakeningIds(raw?: string | null): number[] {
  if (!raw?.trim()) return [];
  return [...raw.matchAll(/\((\d+)\)/g)].map((m) => Number(m[1]));
}

/** Regular awakenings only (text before `|` when present). */
export function parseRegularAwakenings(raw?: string | null): number[] {
  if (!raw?.trim()) return [];
  const [regularPart = ""] = raw.split("|");
  return parseAwakeningIds(regularPart);
}

/** Super awakenings from `super_awakenings` column. */
export function parseSuperAwakenings(raw?: string | null): number[] {
  return parseAwakeningIds(raw);
}

export function parseAwakenings(raw?: string | null): {
  regular: number[];
  super: number[];
} {
  if (!raw?.trim()) return { regular: [], super: [] };
  const [regularPart = "", superPart = ""] = raw.split("|");
  return {
    regular: parseAwakeningIds(regularPart),
    super: parseAwakeningIds(superPart),
  };
}

/** Prefer `super_awakenings` column; fall back to `|` suffix on `awakenings`. */
export function resolveSuperAwakeningIds(
  awakenings?: string | null,
  superAwakenings?: string | null
): number[] {
  const fromColumn = parseSuperAwakenings(superAwakenings);
  if (fromColumn.length) return fromColumn;
  return parseAwakenings(awakenings).super;
}

/**
 * Icons beside the first regular awakening (0.png prefix + row).
 * Monster has either super_awakenings or sync_awsid, not both.
 */
export function resolvePrefixedAwakeningIds(
  awakenings?: string | null,
  superAwakenings?: string | null,
  syncAwsid?: number | null
): number[] {
  const superIds = resolveSuperAwakeningIds(awakenings, superAwakenings);
  if (superIds.length) return superIds;

  const syncId = Number(syncAwsid);
  if (Number.isFinite(syncId) && syncId > 0) return [syncId];

  return [];
}

/** True if awakening id appears in regular, super, or sync slots. */
export function monsterHasAwakening(
  row: {
    awakenings?: string | null;
    super_awakenings?: string | null;
    sync_awsid?: number | null;
  },
  awakeningId: number
): boolean {
  if (parseRegularAwakenings(row.awakenings).includes(awakeningId)) return true;
  if (
    resolveSuperAwakeningIds(row.awakenings, row.super_awakenings).includes(
      awakeningId
    )
  ) {
    return true;
  }
  const sync = Number(row.sync_awsid);
  return Number.isFinite(sync) && sync === awakeningId;
}
