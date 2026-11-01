import type { MonsterRecord } from "../types";

/** `all` keeps JP-only cards. `na` hides cards that have no NA ID. */
export type ResultIdScope = "all" | "na";

export function jpMonsterId(row: MonsterRecord): number | null {
  const id = row.monster_id ?? row.__source_pk;
  return typeof id === "number" && Number.isFinite(id) ? id : null;
}

export type ListedMonsterId = {
  text: string;
  region: "na" | "jp" | "none";
  value: number | null;
};

/** NA ID when the card has one; otherwise the JP ID (`monster_id`). */
export function listedMonsterId(row: MonsterRecord): ListedMonsterId {
  if (row.monster_no_na != null) {
    return {
      text: `#${row.monster_no_na}`,
      region: "na",
      value: row.monster_no_na,
    };
  }
  const jp = jpMonsterId(row);
  if (jp != null) {
    return { text: `JP#${jp}`, region: "jp", value: jp };
  }
  return { text: "—", region: "none", value: null };
}

export function filterRowsByIdScope(
  rows: MonsterRecord[],
  scope: ResultIdScope
): MonsterRecord[] {
  if (scope === "all") return rows;
  return rows.filter((row) => row.monster_no_na != null);
}

function compareJpNewest(a: MonsterRecord, b: MonsterRecord): number {
  const jpA = jpMonsterId(a);
  const jpB = jpMonsterId(b);
  if (jpA == null && jpB == null) return 0;
  if (jpA == null) return 1;
  if (jpB == null) return -1;
  return jpB - jpA;
}

/** Newest list: JP-only cards first (by JP ID), then cards that have an NA ID. */
export function compareNewestCatalog(a: MonsterRecord, b: MonsterRecord): number {
  const naA = a.monster_no_na;
  const naB = b.monster_no_na;
  const jpOnlyA = naA == null;
  const jpOnlyB = naB == null;
  if (jpOnlyA !== jpOnlyB) return jpOnlyA ? -1 : 1;
  if (jpOnlyA) return compareJpNewest(a, b);
  return (naB ?? 0) - (naA ?? 0);
}

/** Tie-break for stat sorts: NA ID newest, JP ID only when neither card has NA. */
export function compareNaIdTiebreak(a: MonsterRecord, b: MonsterRecord): number {
  const naA = a.monster_no_na;
  const naB = b.monster_no_na;
  if (naA == null && naB == null) return compareJpNewest(a, b);
  if (naA == null) return 1;
  if (naB == null) return -1;
  return naB - naA;
}
