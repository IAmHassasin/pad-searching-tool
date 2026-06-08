import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  PatternEntry,
  PatternFilterCategory,
  PatternFilterTag,
  PatternTagSelection,
  PatternsCatalogFile,
  PatternsGroupFile,
  SkillType,
} from "./pattern-types";
import { registerDataSourceRegexp } from "./register-sqlite-regexp";

export function patternTagKey(tag: {
  tag_id: number | null;
  tag_name_en: string;
}): string {
  return tag.tag_id != null ? String(tag.tag_id) : tag.tag_name_en;
}

@Injectable()
export class PatternCatalogService implements OnModuleInit {
  private catalog: PatternEntry[] = [];
  private groups: PatternsGroupFile | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    registerDataSourceRegexp(this.dataSource);
    this.catalog = this.readCatalog().patterns;
    this.groups = this.readGroupsRaw();
  }

  resolveConfigPath(envKey: string, fallback: string): string {
    const fromEnv = process.env[envKey]?.trim();
    const rel = fromEnv || fallback;
    return path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  }

  private readCatalog(): PatternsCatalogFile {
    const filePath = this.resolveConfigPath(
      "PATTERNS_CATALOG_PATH",
      "exports/patterns/pad_generated_patterns.json"
    );
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Patterns catalog not found: ${filePath}`);
    }
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as PatternsCatalogFile;
      if (!Array.isArray(parsed?.patterns)) {
        throw new Error("invalid catalog");
      }
      return parsed;
    } catch {
      throw new NotFoundException(`Invalid patterns catalog: ${filePath}`);
    }
  }

  private readGroupsRaw(): PatternsGroupFile {
    const filePath = this.resolveConfigPath(
      "PATTERNS_GROUP_PATH",
      "exports/patterns/patterns_group.json"
    );
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Patterns group file not found: ${filePath}`);
    }
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as PatternsGroupFile;
      if (
        !Array.isArray(parsed?.active_skill_filters) ||
        !Array.isArray(parsed?.leader_skill_filters)
      ) {
        throw new Error("invalid groups");
      }
      return parsed;
    } catch {
      throw new NotFoundException(`Invalid patterns group file: ${filePath}`);
    }
  }

  private enrichCategory(
    categories: PatternFilterCategory[],
    skillType: SkillType
  ): PatternFilterCategory[] {
    return categories.map((cat) => ({
      ...cat,
      tags: cat.tags.map((tag) => ({
        ...tag,
        patternCount: this.regexPatternsForTag(skillType, patternTagKey(tag))
          .length,
      })),
    }));
  }

  getGroupsManifest(): PatternsGroupFile {
    const g = this.groups;
    if (!g) {
      throw new NotFoundException("Patterns groups not loaded");
    }
    return {
      active_skill_filters: this.enrichCategory(
        g.active_skill_filters,
        "active_skill"
      ),
      leader_skill_filters: this.enrichCategory(
        g.leader_skill_filters,
        "leader_skill"
      ),
    };
  }

  regexPatternsForTag(skillType: SkillType, tagKey: string): string[] {
    const out: string[] = [];
    for (const p of this.catalog) {
      if (p.skill_type !== skillType) continue;
      const key =
        p.tag_id != null ? String(p.tag_id) : p.tag_name_en;
      if (key === tagKey) out.push(p.regex_pattern);
    }
    return out;
  }

  resolveSelections(
    activeTagKeys: string[],
    leaderTagKeys: string[]
  ): PatternTagSelection[] {
    const selections: PatternTagSelection[] = [];
    for (const tagKey of activeTagKeys) {
      const patterns = this.regexPatternsForTag("active_skill", tagKey);
      if (!patterns.length) {
        throw new NotFoundException(
          `No active_skill patterns for tag "${tagKey}"`
        );
      }
      selections.push({ skillType: "active_skill", tagKey });
    }
    for (const tagKey of leaderTagKeys) {
      const patterns = this.regexPatternsForTag("leader_skill", tagKey);
      if (!patterns.length) {
        throw new NotFoundException(
          `No leader_skill patterns for tag "${tagKey}"`
        );
      }
      selections.push({ skillType: "leader_skill", tagKey });
    }
    return selections;
  }

  /** OR-group of regexp() calls for one tag on its skill description column. */
  buildTagOrClause(
    skillType: SkillType,
    tagKey: string,
    columnExpr: string,
    params: unknown[]
  ): string | null {
    const patterns = this.regexPatternsForTag(skillType, tagKey);
    if (!patterns.length) return null;
    const parts = patterns.map((pat) => {
      params.push(pat);
      return `regexp(?, ${columnExpr}) = 1`;
    });
    return `(${parts.join(" OR ")})`;
  }
}
