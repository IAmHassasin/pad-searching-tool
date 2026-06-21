import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from "@nestjs/common";
import { PatternCatalogService } from "../patterns/pattern-catalog.service";
import {
  MonsterSearchFilters,
  PatternSearchService,
} from "./pattern-search.service";

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
    private readonly search: PatternSearchService
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
    @Query("attributes") attributesRaw?: string,
    @Query("hpMin") hpMinRaw?: string,
    @Query("hpMax") hpMaxRaw?: string,
    @Query("atkMin") atkMinRaw?: string,
    @Query("atkMax") atkMaxRaw?: string,
    @Query("rcvMin") rcvMinRaw?: string,
    @Query("rcvMax") rcvMaxRaw?: string,
    @Query("idQuery") idQuery?: string,
    @Query("awakeningIds") awakeningIdsRaw?: string,
    @Query("awakeningMatch") awakeningMatchRaw?: string,
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

    const monster: MonsterSearchFilters = {
      rarity: parseIntCsv(rarityRaw),
      attributes: parseIntCsv(attributesRaw),
      hpMin: parseOptionalNumber(hpMinRaw),
      hpMax: parseOptionalNumber(hpMaxRaw),
      atkMin: parseOptionalNumber(atkMinRaw),
      atkMax: parseOptionalNumber(atkMaxRaw),
      rcvMin: parseOptionalNumber(rcvMinRaw),
      rcvMax: parseOptionalNumber(rcvMaxRaw),
      idQuery: idQuery?.trim() || undefined,
      awakeningIds: awakeningIds.length ? awakeningIds : undefined,
      awakeningMatch: awakeningIds.length ? awakeningMatch : undefined,
    };

    const hasMonsterFilters =
      (monster.rarity?.length ?? 0) > 0 ||
      (monster.attributes?.length ?? 0) > 0 ||
      monster.hpMin != null ||
      monster.hpMax != null ||
      monster.atkMin != null ||
      monster.atkMax != null ||
      monster.rcvMin != null ||
      monster.rcvMax != null ||
      Boolean(monster.idQuery) ||
      (monster.awakeningIds?.length ?? 0) > 0;

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
      limit,
      offset,
    });
  }
}
