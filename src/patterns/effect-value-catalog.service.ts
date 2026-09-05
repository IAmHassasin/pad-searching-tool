import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  EffectValueFamiliesFile,
  EffectValueFamily,
  EffectValueRangeInput,
} from "./effect-value-types";
import type { SkillType } from "./pattern-types";

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
   * value inside the range qualifies the monster).
   */
  buildRangeClause(
    range: EffectValueRangeInput,
    columnExprFor: (skillType: SkillType) => string,
    params: unknown[]
  ): string | null {
    const family = this.byId.get(range.familyId);
    if (!family) {
      throw new BadRequestException(
        `Unknown effect value family: ${range.familyId}`
      );
    }
    const hasMin = range.min != null && Number.isFinite(range.min);
    const hasMax = range.max != null && Number.isFinite(range.max);
    if (!hasMin && !hasMax) return null;
    if (!family.matchers?.length) return null;

    const parts = family.matchers.map((matcher) => {
      params.push(
        matcher.regex,
        matcher.value_group ?? 1,
        hasMin ? range.min : null,
        hasMax ? range.max : null
      );
      return `effect_value_in_range(?, ?, ${columnExprFor(
        matcher.skill_type
      )}, ?, ?) = 1`;
    });

    return `(${parts.join(" OR ")})`;
  }

  /** All families AND'ed together (each is an independent requirement). */
  buildWhere(
    ranges: EffectValueRangeInput[] | undefined,
    columnExprFor: (skillType: SkillType) => string,
    params: unknown[]
  ): string | null {
    if (!ranges?.length) return null;
    const clauses: string[] = [];
    for (const range of ranges) {
      const clause = this.buildRangeClause(range, columnExprFor, params);
      if (clause) clauses.push(clause);
    }
    if (!clauses.length) return null;
    return `(${clauses.join(" AND ")})`;
  }
}
