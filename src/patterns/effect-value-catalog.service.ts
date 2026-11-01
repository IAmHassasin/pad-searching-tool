import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  EffectLoopColumns,
  EffectValueFamiliesFile,
  EffectValueFamily,
  EffectValueRangeInput,
} from "./effect-value-types";
import type { SkillType } from "./pattern-types";
import { loopCopyCount } from "./skill-charge-sql";

function resolveConfigPath(envKey: string, fallback: string): string {
  const fromEnv = process.env[envKey]?.trim();
  const rel = fromEnv || fallback;
  return path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
}

/**
 * Loads the numeric effect-value family manifest and turns user ranges into
 * SQL using the `effect_value_in_range()` SQLite function.
 */
@Injectable()
export class EffectValueCatalogService implements OnModuleInit {
  private families: EffectValueFamily[] = [];
  private byId = new Map<string, EffectValueFamily>();

  onModuleInit(): void {
    this.families = this.readFamilies().families;
    this.byId = new Map(this.families.map((f) => [f.id, f]));
  }

  private readFamilies(): EffectValueFamiliesFile {
    const filePath = resolveConfigPath(
      "EFFECT_VALUE_FAMILIES_PATH",
      "exports/patterns/effect_value_families.json"
    );
    if (!fs.existsSync(filePath)) {
      // Optional file: the rest of search keeps working without it.
      return { families: [] };
    }
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as EffectValueFamiliesFile;
      if (!Array.isArray(parsed?.families)) throw new Error("invalid manifest");
      return parsed;
    } catch {
      throw new NotFoundException(
        `Invalid effect value families file: ${filePath}`
      );
    }
  }

  /** Manifest for the UI — drives the advanced-filter inputs. */
  getFamiliesManifest(): EffectValueFamiliesFile {
    return { families: this.families };
  }

  getFamily(familyId: string): EffectValueFamily | undefined {
    return this.byId.get(familyId);
  }

  /**
   * One family's range clause: OR across its matchers (any matcher hitting a
   * value — and duration — inside the range qualifies the monster).
   */
  buildRangeClause(
    range: EffectValueRangeInput,
    columnExprFor: (skillType: SkillType) => string,
    params: unknown[],
    loopColumns?: EffectLoopColumns | null
  ): string | null {
    const family = this.byId.get(range.familyId);
    if (!family) {
      throw new BadRequestException(
        `Unknown effect value family: ${range.familyId}`
      );
    }
    const finite = (n: number | null | undefined): n is number =>
      n != null && Number.isFinite(n);
    const valueOn = family.supports_value !== false;
    const turnsOn = family.supports_turns === true;
    const min = valueOn && finite(range.min) ? range.min : null;
    const max = valueOn && finite(range.max) ? range.max : null;
    const turnMin = turnsOn && finite(range.turnMin) ? range.turnMin : null;
    const turnMax = turnsOn && finite(range.turnMax) ? range.turnMax : null;
    const wantLoop =
      range.loop === true && turnsOn && range.skillType !== "leader_skill";
    const copies = wantLoop ? loopCopyCount(range.loopCopies) : null;
    if (wantLoop && copies == null) {
      throw new BadRequestException("Loop copies must be 1, 2, or 3.");
    }
    if (
      min == null &&
      max == null &&
      turnMin == null &&
      turnMax == null &&
      !wantLoop
    ) {
      return null;
    }
    if (wantLoop && !loopColumns) {
      throw new BadRequestException(
        "Loop effect filter requires active skill cooldown."
      );
    }

    const matchers = (family.matchers ?? []).filter(
      (m) => !range.skillType || m.skill_type === range.skillType
    );
    const used = wantLoop
      ? matchers.filter((m) => m.skill_type === "active_skill")
      : matchers;
    if (!used.length) return null;

    const parts = used.map((matcher) => {
      params.push(
        matcher.regex,
        valueOn ? (matcher.value_group ?? 1) : 0,
        min,
        max,
        turnMin,
        turnMax
      );
      const column = columnExprFor(matcher.skill_type);
      if (wantLoop && loopColumns && copies != null) {
        params.push(copies);
        return (
          `effect_loop(?, ?, ${column}, ?, ?, ?, ?, ` +
          `${loopColumns.cooldownExpr}, ${loopColumns.chargesPerTurnExpr}, ` +
          `${loopColumns.stageCooldownsExpr}, ?) = 1`
        );
      }
      return `effect_match(?, ?, ${column}, ?, ?, ?, ?) = 1`;
    });

    return `(${parts.join(" OR ")})`;
  }

  /**
   * Ranges that tune one selected effect chip: the family lists the chip's
   * tag key for that skill text, and the range is scoped to it.
   */
  rangesForTag(
    skillType: SkillType,
    tagKey: string,
    ranges: EffectValueRangeInput[] | undefined
  ): EffectValueRangeInput[] {
    if (!ranges?.length) return [];
    return ranges.filter(
      (r) =>
        r.skillType === skillType &&
        (this.byId.get(r.familyId)?.tags?.[skillType] ?? []).includes(tagKey)
    );
  }

  /** All families AND'ed together (each is an independent requirement). */
  buildWhere(
    ranges: EffectValueRangeInput[] | undefined,
    columnExprFor: (skillType: SkillType) => string,
    params: unknown[],
    loopColumns?: EffectLoopColumns | null
  ): string | null {
    if (!ranges?.length) return null;
    const clauses: string[] = [];
    for (const range of ranges) {
      const clause = this.buildRangeClause(
        range,
        columnExprFor,
        params,
        loopColumns
      );
      if (clause) clauses.push(clause);
    }
    if (!clauses.length) return null;
    return `(${clauses.join(" AND ")})`;
  }
}
