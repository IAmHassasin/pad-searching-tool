import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from "@nestjs/common";
import { PatternCatalogService } from "../patterns/pattern-catalog.service";
import { MonsterRelationsService } from "./monster-relations.service";
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

@Controller()
export class PatternsController {
  constructor(
    private readonly catalog: PatternCatalogService,
    private readonly search: PatternSearchService,
    private readonly relations: MonsterRelationsService
  ) {}

  @Get("patterns/groups")
  groups() {
    return this.catalog.getGroupsManifest();
  }

  /**
   * Dynamic monster search: selected pattern tags are OR'd per tag, then
   * combined with patternMatch (any/all). Regex runs in SQLite via regexp().
   */
  @Get("monsters/search")
  async monsterSearch(
    @Query("activeTags") activeTagsRaw?: string,
    @Query("leaderTags") leaderTagsRaw?: string,
    @Query("patternMatch") patternMatchRaw?: string,
    @Query("activeSkillText") activeSkillText?: string,
    @Query("leaderSkillText") leaderSkillText?: string,
    @Query("skillTextMode") skillTextMode?: string,
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
    @Query("limit") limitRaw?: string,
    @Query("offset") offsetRaw?: string
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

    return this.search.search({
      activeTags,
      leaderTags,
      patternMatch,
      activeSkillText,
      leaderSkillText,
      skillTextMode: skillTextModeParsed,
      monster: hasMonsterFilters ? monster : undefined,
      vanish,
      limit,
      offset,
    });
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
