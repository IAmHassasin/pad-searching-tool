import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  SkillCorpusIndex,
  type SkillCorpusEntry,
  type SkillCorpusKind,
  type SkillCorpusMatch,
} from "./skill-corpus";

type Row = { id: number; ja: string | null; en: string | null };

/** In-memory trigram index over the catalog's JP/EN active and leader skill texts, built on first use. */
@Injectable()
export class SkillCorpusService {
  private readonly logger = new Logger(SkillCorpusService.name);
  private index: Promise<SkillCorpusIndex> | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  match(query: string, kind?: SkillCorpusKind, topN = 3): Promise<SkillCorpusMatch[]> {
    return this.load().then((index) => index.match(query, kind, topN));
  }

  private load(): Promise<SkillCorpusIndex> {
    if (!this.index) {
      this.index = this.build().catch((error: unknown) => {
        this.index = null;
        throw error;
      });
    }
    return this.index;
  }

  private async build(): Promise<SkillCorpusIndex> {
    const entries: SkillCorpusEntry[] = [];
    const actives = (await this.dataSource.query(
      `SELECT active_skill_id AS id, desc_ja AS ja, desc_en AS en FROM active_skills WHERE desc_ja != '' AND desc_en != ''`
    )) as Row[];
    for (const r of actives) {
      if (r.ja && r.en) entries.push({ kind: "active", id: r.id, ja: r.ja, en: r.en });
    }
    const leaders = (await this.dataSource.query(
      `SELECT leader_skill_id AS id, desc_ja AS ja, desc_en AS en FROM leader_skills WHERE desc_ja != '' AND desc_en != ''`
    )) as Row[];
    for (const r of leaders) {
      if (r.ja && r.en) entries.push({ kind: "leader", id: r.id, ja: r.ja, en: r.en });
    }
    const index = new SkillCorpusIndex(entries);
    this.logger.log(`Skill corpus index built: ${index.size} entries`);
    return index;
  }
}
