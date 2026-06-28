import { Injectable, NotFoundException } from "@nestjs/common";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MonsterRelationsService } from "../api/monster-relations.service";

export type DungeonSummary = {
  appmediaPostId: number;
  titleJa: string;
  titleEn: string | null;
  sourceUrl: string;
  modified: string | null;
  importedAt: string;
};

type EnglishTranslations = {
  titles?: Record<string, string>;
  gimmicks?: Record<string, string>;
  phrases?: [string, string][];
};

type ParsedDungeon = {
  appmediaPostId: number;
  titleJa: string;
  titleEn?: string;
  floors: Array<{
    spawns: Array<{
      monsterId: number | null;
      monsterNameJa?: string | null;
      nameEn?: string | null;
      nameJp?: string | null;
    }>;
  }>;
};

@Injectable()
export class DungeonDetailsService {
  private readonly seedDir: string;
  private readonly translationsDir: string;
  private translationsCache: EnglishTranslations | null = null;

  constructor(private readonly monsters: MonsterRelationsService) {
    const seedRoot =
      process.env.DUNGEON_DETAILS_SEED_ROOT?.trim() ||
      join(process.cwd(), "dungeon-details/seed");
    this.seedDir =
      process.env.DUNGEON_DETAILS_SEED_DIR?.trim() ||
      join(seedRoot, "dungeons");
    this.translationsDir = join(seedRoot, "translations");
  }

  private loadTranslations(): EnglishTranslations {
    if (this.translationsCache) return this.translationsCache;
    const filePath = join(this.translationsDir, "en.json");
    if (!existsSync(filePath)) {
      this.translationsCache = {};
      return this.translationsCache;
    }
    this.translationsCache = JSON.parse(
      readFileSync(filePath, "utf8")
    ) as EnglishTranslations;
    return this.translationsCache;
  }

  translateTitle(titleJa: string, postId?: number): string {
    const glossary = this.loadTranslations();
    const stripped = titleJa.replace(/^【パズドラ】/, "").trim();
    if (postId != null) {
      const byId = glossary.titles?.[String(postId)];
      if (byId) return byId;
    }
    const byExact = glossary.titles?.[stripped] ?? glossary.titles?.[titleJa];
    if (byExact) return byExact;

    let out = stripped;
    const phrases = [...(glossary.phrases ?? [])].sort(
      (a, b) => b[0].length - a[0].length
    );
    for (const [ja, en] of phrases) {
      if (out.includes(ja)) out = out.split(ja).join(en);
    }
    return out.replace(/\s+/g, " ").trim();
  }

  listDungeons(): { dungeons: DungeonSummary[] } {
    if (!existsSync(this.seedDir)) {
      return { dungeons: [] };
    }

    const dungeons = readdirSync(this.seedDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => {
        const raw = readFileSync(join(this.seedDir, name), "utf8");
        const data = JSON.parse(raw) as DungeonSummary & { titleJa: string };
        return {
          appmediaPostId: data.appmediaPostId,
          titleJa: data.titleJa,
          titleEn:
            (data as { titleEn?: string }).titleEn ??
            this.translateTitle(data.titleJa, data.appmediaPostId),
          sourceUrl: data.sourceUrl,
          modified: data.modified ?? null,
          importedAt: data.importedAt,
        };
      })
      .sort((a, b) => b.appmediaPostId - a.appmediaPostId);

    return { dungeons };
  }

  async getDungeon(postId: number): Promise<unknown> {
    if (!Number.isFinite(postId) || postId <= 0) {
      throw new NotFoundException(`Invalid dungeon id: ${postId}`);
    }

    const filePath = join(this.seedDir, `${postId}.json`);
    if (!existsSync(filePath)) {
      throw new NotFoundException(`Dungeon ${postId} not found`);
    }

    const dungeon = JSON.parse(readFileSync(filePath, "utf8")) as ParsedDungeon;
    dungeon.titleEn =
      dungeon.titleEn ?? this.translateTitle(dungeon.titleJa, postId);

    const ids = new Set<number>();
    for (const floor of dungeon.floors ?? []) {
      for (const spawn of floor.spawns ?? []) {
        if (spawn.monsterId != null && spawn.monsterId > 0) {
          ids.add(spawn.monsterId);
        }
      }
    }

    if (ids.size > 0) {
      const rows = await this.monsters.lookupMonstersByIds([...ids]);
      const byId = new Map(
        rows.map((row) => [Number(row.monster_id), row] as const)
      );
      for (const floor of dungeon.floors ?? []) {
        for (const spawn of floor.spawns ?? []) {
          if (!spawn.monsterId) continue;
          const row = byId.get(spawn.monsterId);
          if (!row) continue;
          spawn.nameEn =
            typeof row.name_en === "string" ? row.name_en.trim() || null : null;
          spawn.nameJp =
            typeof row.name_jp === "string" ? row.name_jp.trim() || null : null;
        }
      }
    }

    return dungeon;
  }

  getEnglishTranslations(): unknown {
    const filePath = join(this.translationsDir, "en.json");
    if (!existsSync(filePath)) {
      throw new NotFoundException("English translations not found");
    }
    return JSON.parse(readFileSync(filePath, "utf8"));
  }
}
