import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import translate from "google-translate-api-x";
import { DataSource } from "typeorm";
import {
  type CachedMonsterName,
  type MonsterNameSource,
  translateJapaneseLabels,
  translateMonsterNameRows,
} from "./japanese-name";

const MAX_LOOKUP_IDS = 40;

type NameRow = {
  monster_id: number;
  name_en: string | null;
  name_jp: string | null;
};

async function translateJapaneseBatch(texts: string[]): Promise<string[]> {
  if (!texts.length) return [];
  const result = await translate(texts, {
    from: "ja",
    to: "en",
    forceBatch: true,
    rejectOnPartialFail: false,
  });
  const list = Array.isArray(result) ? result : [result];
  return texts.map((source, index) => {
    const text = list[index]?.text;
    return typeof text === "string" && text.trim() ? text.trim() : source;
  });
}

@Injectable()
export class NameTranslationService {
  private readonly logger = new Logger(NameTranslationService.name);
  private readonly cache = new Map<number, CachedMonsterName>();
  private readonly labelCache = new Map<string, string>();
  /** One upstream batch at a time so a fast scroll does not stampede Google. */
  private chain: Promise<void> = Promise.resolve();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  translateByIds(ids: number[]): Promise<Record<string, string>> {
    const unique = [
      ...new Set(ids.filter((id) => Number.isInteger(id) && id > 0)),
    ].slice(0, MAX_LOOKUP_IDS);
    if (!unique.length) return Promise.resolve({});
    return this.enqueue(() => this.resolve(unique));
  }

  /** Same Japanese-to-English batch path as monster names on the search screen. */
  translateLabels(labels: string[]): Promise<string[]> {
    if (!labels.length) return Promise.resolve([]);
    return this.enqueue(() =>
      translateJapaneseLabels(labels, this.labelCache, async (texts) => {
        try {
          return await translateJapaneseBatch(texts);
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown error";
          this.logger.warn(`Label translation failed: ${message}`);
          throw error;
        }
      })
    );
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.chain.then(job, job);
    this.chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async resolve(ids: number[]): Promise<Record<string, string>> {
    let rows: NameRow[];
    try {
      const placeholders = ids.map(() => "?").join(", ");
      rows = (await this.dataSource.query(
        `SELECT monster_id, name_en, name_ja AS name_jp
         FROM monsters
         WHERE monster_id IN (${placeholders})`,
        ids
      )) as NameRow[];
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      this.logger.warn(`Monster name lookup failed: ${message}`);
      return {};
    }

    const sources: MonsterNameSource[] = rows.map((row) => ({
      monsterId: Number(row.monster_id),
      nameEn: row.name_en,
      nameJp: row.name_jp,
    }));

    try {
      return await translateMonsterNameRows(
        sources,
        this.cache,
        translateJapaneseBatch
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      this.logger.warn(`Monster name translation failed: ${message}`);
      return {};
    }
  }
}
