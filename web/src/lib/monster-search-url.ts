import {
  parseAdvancedEffectFilters,
  serializeAdvancedEffectFilters,
  type AdvancedEffectFilters,
  type MonsterRecord,
  type MonsterFilters,
  type PatternGroupsManifest,
  type SelectedPatternTag,
  type SkillFilters,
} from "../types";
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

export function parseAttributeSlot2FromSearch(search: string): number[] | null {
  return parseIntCsvParam(search, "attributeSlot2");
}

export function parseAttributeSlot3FromSearch(search: string): number[] | null {
  return parseIntCsvParam(search, "attributeSlot3");
}

function parseOptionalNumberParam(search: string, key: string): number | null {
  const raw = new URLSearchParams(search).get(key);
  if (!raw?.trim()) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : null;
}

function parseStringParam(search: string, key: string): string {
  return new URLSearchParams(search).get(key)?.trim() ?? "";
}

export function parseMonsterFiltersFromSearch(
  search: string,
  fallback: MonsterFilters
): MonsterFilters {
  const attributeSlots = fallback.attributeSlots.map(
    (slot) => new Set(slot)
  ) as MonsterFilters["attributeSlots"];
  const attribute1 = parseAttributeSlot1FromSearch(search);
  const attribute2 = parseAttributeSlot2FromSearch(search);
  const attribute3 = parseAttributeSlot3FromSearch(search);
  if (attribute1?.length) attributeSlots[0] = new Set(attribute1);
  if (attribute2?.length) attributeSlots[1] = new Set(attribute2);
  if (attribute3?.length) attributeSlots[2] = new Set(attribute3);

  const q = new URLSearchParams(search);
  const attributeMatch = q.get("attributeMatch") === "any" ? "any" : "all";

  return {
    ...fallback,
    rarity: new Set(parseIntCsvParam(search, "rarity") ?? []),
    attributeSlots,
    attributeMatch,
    types: new Set(parseTypesFromSearch(search) ?? []),
    hpMin: parseOptionalNumberParam(search, "hpMin"),
    hpMax: parseOptionalNumberParam(search, "hpMax"),
    atkMin: parseOptionalNumberParam(search, "atkMin"),
    atkMax: parseOptionalNumberParam(search, "atkMax"),
    rcvMin: parseOptionalNumberParam(search, "rcvMin"),
    rcvMax: parseOptionalNumberParam(search, "rcvMax"),
    idQuery: parseStringParam(search, "idQuery"),
    awakeningIds: parseAwakeningIdsFromSearch(search) ?? [],
    excludedAwakeningIds: parseExcludedAwakeningIdsFromSearch(search) ?? [],
    vanishOnly: q.get("vanishOnly") === "1" || q.get("vanishOnly") === "true",
    vanishAwakeningIds: parseIntCsvParam(search, "vanishAwakeningIds") ?? [],
  };
}

export function parseSkillFiltersFromSearch(
  search: string,
  fallback: SkillFilters
): SkillFilters {
  const q = new URLSearchParams(search);
  const skillTextMode = q.get("skillTextMode");
  const patternMatch = q.get("patternMatch");
  return {
    ...fallback,
    activeSkillText: parseStringParam(search, "activeSkillText"),
    leaderSkillText: parseStringParam(search, "leaderSkillText"),
    skillTextMode:
      skillTextMode === "active" || skillTextMode === "leader"
        ? skillTextMode
        : "both",
    patternMatch: patternMatch === "any" ? "any" : "all",
  };
}

export function parsePatternTagKeysFromSearch(search: string): {
  activeTags: string[];
  leaderTags: string[];
} {
  const parseCsvStrings = (key: string) =>
    (new URLSearchParams(search).get(key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return {
    activeTags: parseCsvStrings("activeTags"),
    leaderTags: parseCsvStrings("leaderTags"),
  };
}

export function resolveSelectedPatterns(
  patternGroups: PatternGroupsManifest,
  keys: { activeTags: string[]; leaderTags: string[] }
): SelectedPatternTag[] {
  const byType = (
    skillType: "active_skill" | "leader_skill",
    categories: PatternGroupsManifest["active_skill_filters"],
    wanted: string[]
  ): SelectedPatternTag[] => {
    const wantedSet = new Set(wanted);
    const out: SelectedPatternTag[] = [];
    for (const category of categories) {
      for (const tag of category.tags) {
        const key = tag.tag_id != null ? String(tag.tag_id) : tag.tag_name_en;
        if (wantedSet.has(key)) {
          out.push({ skillType, tagKey: key, label: tag.label });
        }
      }
    }
    return out;
  };

  return [
    ...byType("active_skill", patternGroups.active_skill_filters, keys.activeTags),
    ...byType("leader_skill", patternGroups.leader_skill_filters, keys.leaderTags),
  ];
}

function setCsv(q: URLSearchParams, key: string, values: number[] | string[]) {
  if (values.length) q.set(key, values.join(","));
}

export function buildSearchParamsFromFilters(
  monsterFilters: MonsterFilters,
  skillFilters: SkillFilters,
  advancedEffectFilters?: AdvancedEffectFilters
): URLSearchParams {
  const q = new URLSearchParams();
  setCsv(q, "rarity", [...monsterFilters.rarity]);
  monsterFilters.attributeSlots.forEach((slot, index) => {
    setCsv(q, `attributeSlot${index + 1}`, [...slot]);
  });
  if (monsterFilters.attributeSlots.some((slot) => slot.size > 0)) {
    q.set("attributeMatch", monsterFilters.attributeMatch);
  }
  setCsv(q, "types", [...monsterFilters.types]);
  if (monsterFilters.hpMin != null) q.set("hpMin", String(monsterFilters.hpMin));
  if (monsterFilters.hpMax != null) q.set("hpMax", String(monsterFilters.hpMax));
  if (monsterFilters.atkMin != null) q.set("atkMin", String(monsterFilters.atkMin));
  if (monsterFilters.atkMax != null) q.set("atkMax", String(monsterFilters.atkMax));
  if (monsterFilters.rcvMin != null) q.set("rcvMin", String(monsterFilters.rcvMin));
  if (monsterFilters.rcvMax != null) q.set("rcvMax", String(monsterFilters.rcvMax));
  if (monsterFilters.idQuery.trim()) q.set("idQuery", monsterFilters.idQuery.trim());
  setCsv(q, "awakeningIds", monsterFilters.awakeningIds);
  if (monsterFilters.awakeningIds.length > 0) q.set("awakeningMatch", "all");
  setCsv(q, "excludedAwakeningIds", monsterFilters.excludedAwakeningIds);
  if (monsterFilters.vanishOnly) q.set("vanishOnly", "1");
  setCsv(q, "vanishAwakeningIds", monsterFilters.vanishAwakeningIds);
  if (monsterFilters.vanishAwakeningIds.length > 0) {
    q.set("vanishAwakeningMatch", "all");
  }

  const activeTags = skillFilters.selectedPatterns
    .filter((p) => p.skillType === "active_skill")
    .map((p) => p.tagKey);
  const leaderTags = skillFilters.selectedPatterns
    .filter((p) => p.skillType === "leader_skill")
    .map((p) => p.tagKey);
  setCsv(q, "activeTags", activeTags);
  setCsv(q, "leaderTags", leaderTags);
  q.set("patternMatch", skillFilters.patternMatch);
  q.set("skillTextMode", skillFilters.skillTextMode);
  if (skillFilters.activeSkillText.trim()) {
    q.set("activeSkillText", skillFilters.activeSkillText.trim());
  }
  if (skillFilters.leaderSkillText.trim()) {
    q.set("leaderSkillText", skillFilters.leaderSkillText.trim());
  }

  if (advancedEffectFilters) {
    const effect = serializeAdvancedEffectFilters(advancedEffectFilters);
    if (effect) q.set("effect", effect);
  }

  return q;
}

export function parseAdvancedEffectFiltersFromSearch(
  search: string
): AdvancedEffectFilters {
  const params = new URLSearchParams(search);
  return parseAdvancedEffectFilters(params.get("effect"));
}

export function buildShareSearchUrl(
  monsterFilters: MonsterFilters,
  skillFilters: SkillFilters,
  advancedEffectFilters?: AdvancedEffectFilters
): string {
  const q = buildSearchParamsFromFilters(
    monsterFilters,
    skillFilters,
    advancedEffectFilters
  ).toString();
  return q ? `/?${q}` : "/";
}

/** Google search for a monster: "パズドラ" + its Japanese name (falls back to the English name). */
export function buildMonsterGoogleSearchUrl(
  row: Pick<MonsterRecord, "name_jp" | "name_en">
): string | null {
  const name = row.name_jp?.trim() || row.name_en?.trim();
  if (!name) return null;
  const query = new URLSearchParams({ q: `パズドラ ${name}` });
  return `https://www.google.com/search?${query}`;
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
