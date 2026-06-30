import type { MonsterRecord } from "../types";
import { parseMonsterTypeIds } from "./monster-types";

/** Assist equipment awakening — search target for Resonate links. */
export const ASSIST_EQUIPMENT_AWAKENING_ID = 49;

/** Awakening id 49 — excluded on every monster-search link from One-Touch. */
export const ONE_TOUCH_EXCLUDED_AWAKENING_ID = ASSIST_EQUIPMENT_AWAKENING_ID;

export type MonsterSearchAwakeningUrlOptions = {
  excludedAwakeningIds?: number[];
};

/** Build / search URL with awakening stack (duplicates = min count per id, match all). */
export function buildMonsterSearchAwakeningUrl(
  entries: { id: number; count: number }[],
  options?: MonsterSearchAwakeningUrlOptions
): string {
  const ids: number[] = [];
  for (const { id, count } of entries) {
    const n = Math.max(1, Math.min(8, Math.floor(count)));
    for (let i = 0; i < n; i++) ids.push(id);
  }
  if (!ids.length) return "/";
  const q = new URLSearchParams();
  q.set("awakeningIds", ids.join(","));
  q.set("awakeningMatch", "all");
  const excluded = [
    ...new Set(
      (options?.excludedAwakeningIds ?? []).filter(
        (id) => Number.isFinite(id) && id > 0
      )
    ),
  ];
  if (excluded.length) {
    q.set("excludedAwakeningIds", excluded.join(","));
  }
  return `/?${q}`;
}

export function buildOneTouchMonsterSearchUrl(
  entries: { id: number; count: number }[]
): string {
  return buildMonsterSearchAwakeningUrl(entries, {
    excludedAwakeningIds: [ONE_TOUCH_EXCLUDED_AWAKENING_ID],
  });
}

function parseIntCsvParam(search: string, key: string): number[] | null {
  const raw = new URLSearchParams(search).get(key);
  if (!raw?.trim()) return null;
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length ? ids : null;
}

export function parseAwakeningIdsFromSearch(
  search: string
): number[] | null {
  return parseIntCsvParam(search, "awakeningIds");
}

export function parseExcludedAwakeningIdsFromSearch(
  search: string
): number[] | null {
  return parseIntCsvParam(search, "excludedAwakeningIds");
}

export function parseTypesFromSearch(search: string): number[] | null {
  return parseIntCsvParam(search, "types");
}

export function parseAttributeSlot1FromSearch(search: string): number[] | null {
  return parseIntCsvParam(search, "attributeSlot1");
}

/** Assist eq search: awk 49, host primary attribute, any host type. */
export function buildAssistResonanceSearchUrl(
  row: Pick<
    MonsterRecord,
    "attribute_1_id" | "type_1_id" | "type_2_id" | "type_3_id"
  >
): string | null {
  const primaryAttr = row.attribute_1_id;
  const typeIds = parseMonsterTypeIds(row);
  if (primaryAttr == null || !Number.isFinite(primaryAttr) || !typeIds.length) {
    return null;
  }

  const q = new URLSearchParams();
  q.set("awakeningIds", String(ASSIST_EQUIPMENT_AWAKENING_ID));
  q.set("awakeningMatch", "all");
  q.set("attributeSlot1", String(primaryAttr));
  q.set("attributeMatch", "all");
  q.set("types", typeIds.join(","));
  return `/?${q}`;
}
