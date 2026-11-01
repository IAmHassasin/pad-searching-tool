import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from "@nestjs/common";
import { EffectValueCatalogService } from "../patterns/effect-value-catalog.service";
import type { EffectValueRangeInput } from "../patterns/effect-value-types";
import { PatternCatalogService } from "../patterns/pattern-catalog.service";
import { MonsterRelationsService } from "./monster-relations.service";
import { NameTranslationService } from "./name-translation.service";
import {
  MonsterSearchFilters,
  PatternSearchService,
} from "./pattern-search.service";
import type { VanishSearchFilters } from "./vanish-awoken.service";

function parseCsv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseMonsterIdList(raw: unknown): number[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new BadRequestException("ids must be an array of numbers.");
  }
  const ids: number[] = [];
  for (const item of raw) {
    const n = typeof item === "number" ? item : Number(item);
    if (!Number.isInteger(n) || n <= 0) {
      throw new BadRequestException("ids must be positive integers.");
    }
    ids.push(n);
  }
  return [...new Set(ids)];
}

function parseIntCsv(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  const out: number[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (!t) continue;
    const n = Number(t);
    if (!Number.isFinite(n)) {
      throw new BadRequestException(`Invalid number in list: ${t}`);
    }
    out.push(n);
  }
  return out;
}

function parseOptionalNumber(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new BadRequestException(`Invalid number: ${raw}`);
  }
  return n;
}

const EFFECT_SCOPES: Record<string, EffectValueRangeInput["skillType"]> = {
  a: "active_skill",
  l: "leader_skill",
};

function parseLoopCopiesToken(
  raw: string | undefined,
  effectId: string
): 1 | 2 | 3 | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  if (raw === "1" || raw === "2" || raw === "3") {
    return Number(raw) as 1 | 2 | 3;
  }
  throw new BadRequestException(
    `Effect filter "${effectId}": loop copies must be 1, 2, or 3.`
  );
}

/**
 * `effect=familyId[@a|@l]:min:max[:turnMin:turnMax[:copies]],...` — any bound
 * may be empty for unbounded; `@a` / `@l` scope the range to the active /
 * leader chip it tunes. A trailing `1`, `2`, or `3` requires that effect to
 * loop with that many copies of the active.
 * e.g. `effect=shield_percent@a:50::2:,damage_cap_buff@a:::::2`.
 */
function parseEffectRanges(raw: string | undefined): EffectValueRangeInput[] {
  if (!raw?.trim()) return [];
  const out: EffectValueRangeInput[] = [];
  for (const part of raw.split(",")) {
    const spec = part.trim();
    if (!spec) continue;
    const [idRaw, minRaw, maxRaw, turnMinRaw, turnMaxRaw, loopRaw] =
      spec.split(":");
    const idParts = (idRaw ?? "").split("@");
    const id = idParts[0]?.trim();
    const scope = idParts[1]?.trim();
    if (!id || idParts.length > 2 || (scope != null && !EFFECT_SCOPES[scope])) {
      throw new BadRequestException(`Invalid effect filter: ${spec}`);
    }
    const min = parseOptionalNumber(minRaw);
    const max = parseOptionalNumber(maxRaw);
    const turnMin = parseOptionalNumber(turnMinRaw);
    const turnMax = parseOptionalNumber(turnMaxRaw);
    const loopCopies = parseLoopCopiesToken(loopRaw, id);
    const loop = loopCopies != null;
    if (
      min == null &&
      max == null &&
      turnMin == null &&
      turnMax == null &&
      !loop
    ) {
      continue;
    }
    if (min != null && max != null && min > max) {
      throw new BadRequestException(
        `Effect filter "${id}": min (${min}) is greater than max (${max}).`
      );
    }
    if (turnMin != null && turnMax != null && turnMin > turnMax) {
      throw new BadRequestException(
        `Effect filter "${id}": turn min (${turnMin}) is greater than turn max (${turnMax}).`
      );
    }
    out.push({
      familyId: id,
      skillType: scope ? EFFECT_SCOPES[scope] : undefined,
      min,
      max,
      turnMin,
      turnMax,
      loop,
      loopCopies,
    });
  }
  return out;
}

@Controller()
export class PatternsController {
  constructor(
    private readonly catalog: PatternCatalogService,
    private readonly effectValues: EffectValueCatalogService,
    private readonly search: PatternSearchService,
    private readonly relations: MonsterRelationsService,
    private readonly names: NameTranslationService
  ) {}

  @Get("patterns/groups")
  groups() {
    return this.catalog.getGroupsManifest();
  }

  /** Numeric effect-value families for the advanced search UI. */
  @Get("patterns/effect-families")
  effectFamilies() {
    return this.effectValues.getFamiliesManifest();
  }

  /**
   * Dynamic monster search: selected pattern tags are combined with
   * patternMatch (any/all). Official tag ids match dadguide skill tags;
   * custom tags still use regexp() on the skill description.
   */
  @Get("monsters/search")
  async monsterSearch(
    @Query("activeTags") activeTagsRaw?: string,
    @Query("leaderTags") leaderTagsRaw?: string,
    @Query("patternMatch") patternMatchRaw?: string,
    @Query("activeSkillText") activeSkillText?: string,
    @Query("leaderSkillText") leaderSkillText?: string,
    @Query("skillTextMode") skillTextMode?: string,
    @Query("activeCdMin") activeCdMinRaw?: string,
    @Query("activeCdMax") activeCdMaxRaw?: string,
    @Query("rarity") rarityRaw?: string,
    @Query("attributeSlot1") attributeSlot1Raw?: string,
    @Query("attributeSlot2") attributeSlot2Raw?: string,
    @Query("attributeSlot3") attributeSlot3Raw?: string,
    @Query("attributeMatch") attributeMatchRaw?: string,
    @Query("types") typesRaw?: string,
    @Query("hpMin") hpMinRaw?: string,
    @Query("hpMax") hpMaxRaw?: string,
    @Query("atkMin") atkMinRaw?: string,
    @Query("atkMax") atkMaxRaw?: string,
    @Query("rcvMin") rcvMinRaw?: string,
    @Query("rcvMax") rcvMaxRaw?: string,
    @Query("idQuery") idQuery?: string,
    @Query("awakeningIds") awakeningIdsRaw?: string,
    @Query("awakeningMatch") awakeningMatchRaw?: string,
    @Query("excludedAwakeningIds") excludedAwakeningIdsRaw?: string,
    @Query("vanishOnly") vanishOnlyRaw?: string,
    @Query("vanishAwakeningIds") vanishAwakeningIdsRaw?: string,
    @Query("vanishAwakeningMatch") vanishAwakeningMatchRaw?: string,
    @Query("excludedVanishAwakeningIds") excludedVanishAwakeningIdsRaw?: string,
    @Query("effect") effectRaw?: string,
    @Query("limit") limitRaw?: string,
    @Query("offset") offsetRaw?: string,
    @Query("skipCount") skipCountRaw?: string
  ) {
    const patternMatch =
      patternMatchRaw?.trim() === "all" ? "all" : ("any" as const);

    const mode = skillTextMode?.trim();
    const skillTextModeParsed =
      mode === "active" || mode === "leader" || mode === "both"
        ? mode
        : "both";

    const limit = Math.min(
      Math.max(Number(limitRaw ?? "500") || 500, 1),
      5000
    );
    const offset = Math.max(Number(offsetRaw ?? "0") || 0, 0);

    const awakeningMatch =
      awakeningMatchRaw?.trim() === "any" ? "any" : ("all" as const);
    const awakeningIds = parseIntCsv(awakeningIdsRaw);
    const excludedAwakeningIds = parseIntCsv(excludedAwakeningIdsRaw);

    const vanishOnly =
      vanishOnlyRaw?.trim() === "1" ||
      vanishOnlyRaw?.trim().toLowerCase() === "true";
    const vanishAwakeningMatch =
      vanishAwakeningMatchRaw?.trim() === "any" ? "any" : ("all" as const);
    const vanishAwakeningIds = parseIntCsv(vanishAwakeningIdsRaw);
    const excludedVanishAwakeningIds = parseIntCsv(
      excludedVanishAwakeningIdsRaw
    );

    const types = parseIntCsv(typesRaw);
    const attributeSlots: [number[], number[], number[]] = [
      parseIntCsv(attributeSlot1Raw),
      parseIntCsv(attributeSlot2Raw),
      parseIntCsv(attributeSlot3Raw),
    ];
    const hasAttributeFilters = attributeSlots.some((slot) => slot.length > 0);
    const attributeMatch =
      attributeMatchRaw?.trim() === "any" ? "any" : ("all" as const);

    const monster: MonsterSearchFilters = {
      rarity: parseIntCsv(rarityRaw),
      attributeSlots: hasAttributeFilters ? attributeSlots : undefined,
      attributeMatch: hasAttributeFilters ? attributeMatch : undefined,
      types: types.length ? types : undefined,
      hpMin: parseOptionalNumber(hpMinRaw),
      hpMax: parseOptionalNumber(hpMaxRaw),
      atkMin: parseOptionalNumber(atkMinRaw),
      atkMax: parseOptionalNumber(atkMaxRaw),
      rcvMin: parseOptionalNumber(rcvMinRaw),
      rcvMax: parseOptionalNumber(rcvMaxRaw),
      idQuery: idQuery?.trim() || undefined,
      awakeningIds: awakeningIds.length ? awakeningIds : undefined,
      awakeningMatch: awakeningIds.length ? awakeningMatch : undefined,
      excludedAwakeningIds: excludedAwakeningIds.length
        ? excludedAwakeningIds
        : undefined,
    };

    const hasMonsterFilters =
      (monster.rarity?.length ?? 0) > 0 ||
      (monster.attributeSlots?.some((s) => s.length > 0) ?? false) ||
      (monster.types?.length ?? 0) > 0 ||
      monster.hpMin != null ||
      monster.hpMax != null ||
      monster.atkMin != null ||
      monster.atkMax != null ||
      monster.rcvMin != null ||
      monster.rcvMax != null ||
      Boolean(monster.idQuery) ||
      (monster.awakeningIds?.length ?? 0) > 0 ||
      (monster.excludedAwakeningIds?.length ?? 0) > 0;

    const hasVanishFilters =
      vanishOnly ||
      vanishAwakeningIds.length > 0 ||
      excludedVanishAwakeningIds.length > 0;

    const vanish: VanishSearchFilters | undefined = hasVanishFilters
      ? {
          vanishOnly: vanishOnly || undefined,
          vanishAwakeningIds: vanishAwakeningIds.length
            ? vanishAwakeningIds
            : undefined,
          vanishAwakeningMatch: vanishAwakeningIds.length
            ? vanishAwakeningMatch
            : undefined,
          excludedVanishAwakeningIds: excludedVanishAwakeningIds.length
            ? excludedVanishAwakeningIds
            : undefined,
        }
      : undefined;

    const activeTags = parseCsv(activeTagsRaw);
    const leaderTags = parseCsv(leaderTagsRaw);
    const effectRanges = parseEffectRanges(effectRaw);
    const activeCdMin = parseOptionalNumber(activeCdMinRaw);
    const activeCdMax = parseOptionalNumber(activeCdMaxRaw);
    if (activeCdMin != null && activeCdMax != null && activeCdMin > activeCdMax) {
      throw new BadRequestException(
        `Active skill CD: min (${activeCdMin}) is greater than max (${activeCdMax}).`
      );
    }

    return this.search.search({
      activeTags,
      leaderTags,
      patternMatch,
      activeSkillText,
      leaderSkillText,
      skillTextMode: skillTextModeParsed,
      activeCdMin,
      activeCdMax,
      monster: hasMonsterFilters ? monster : undefined,
      vanish,
      effectRanges: effectRanges.length ? effectRanges : undefined,
      limit,
      offset,
      skipCount:
        skipCountRaw?.trim() === "1" ||
        skipCountRaw?.trim().toLowerCase() === "true",
    });
  }

  /**
   * English display names for monsters whose stored name is still Japanese.
   * Looks up names by id; does not accept free text.
   */
  @Post("monsters/translate-names")
  translateNames(@Body() body: { ids?: unknown }) {
    const ids = parseMonsterIdList(body?.ids);
    if (ids.length > 40) {
      throw new BadRequestException("Too many ids (max 40).");
    }
    return this.names.translateByIds(ids).then((names) => ({ names }));
  }

  @Get("monsters/lookup")
  async lookupMonsters(@Query("ids") idsRaw?: string) {
    const ids = parseIntCsv(idsRaw);
    if (!ids.length) {
      throw new BadRequestException("ids is required.");
    }
    if (ids.length > 50) {
      throw new BadRequestException("Too many ids (max 50).");
    }
    const rows = await this.relations.lookupMonstersByIds(ids);
    return { rows };
  }

  @Get("monsters/evo-tree")
  evoTree(@Query("monsterId") monsterIdRaw?: string) {
    const monsterId = Number(monsterIdRaw);
    if (!Number.isFinite(monsterId) || monsterId <= 0) {
      throw new BadRequestException("monsterId is required.");
    }
    return this.relations.getEvoTree(monsterId);
  }

  @Get("monsters/collab-group")
  collabGroup(@Query("monsterId") monsterIdRaw?: string) {
    const monsterId = Number(monsterIdRaw);
    if (!Number.isFinite(monsterId) || monsterId <= 0) {
      throw new BadRequestException("monsterId is required.");
    }
    return this.relations.getCollabGroup(monsterId);
  }
}
