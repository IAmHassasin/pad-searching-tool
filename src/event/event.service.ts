import { Injectable, NotFoundException } from "@nestjs/common";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MonsterRelationsService } from "../api/monster-relations.service";

export type EventEntryRole = "new-monster" | "new-evolution" | "returning";

type SeedEntry = {
  monsterId?: number;
  manual?: Record<string, unknown>;
  role: EventEntryRole;
  /** Display label on the card (replaces former section/category heading). */
  label?: string;
  note?: string;
};

/** @deprecated Prefer flat `entries` with per-entry `label`. */
type SeedSection = {
  heading: string;
  entries: SeedEntry[];
};

type SeedEvent = {
  eventId: string;
  title: string;
  subtitle?: string;
  publishedAt?: string;
  sourceUrl?: string;
  coverMonsterIds?: number[];
  /** Intro loader — theme id registered on the web client. */
  loading?: { theme: string; minMs?: number; asset?: string };
  /** Flat showcase list — preferred. */
  entries?: SeedEntry[];
  /** @deprecated Use `entries` + `label` instead. */
  sections?: SeedSection[];
};

export type EventSummary = {
  eventId: string;
  title: string;
  subtitle: string | null;
  publishedAt: string | null;
};

export type MonsterFamily = {
  monsterId: number;
  baseId: number;
  coverMonsterId: number;
  nodes: Record<string, unknown>[];
  edges: { from: number; to: number; kind: "evolution" | "transform" }[];
};

export type EventEntryDetail = {
  role: EventEntryRole;
  label: string | null;
  note: string | null;
  family: MonsterFamily;
};

export type EventDetail = EventSummary & {
  sourceUrl: string | null;
  coverMonsters: Record<string, unknown>[];
  entries: EventEntryDetail[];
  loading: { theme: string; minMs?: number; asset?: string } | null;
};

@Injectable()
export class EventService {
  private readonly seedDir: string;

  constructor(private readonly monsters: MonsterRelationsService) {
    const seedRoot =
      process.env.EVENT_SEED_ROOT?.trim() || join(process.cwd(), "event/seed");
    this.seedDir = process.env.EVENT_SEED_DIR?.trim() || join(seedRoot, "events");
  }

  private loadSeed(eventId: string): SeedEvent | null {
    const filePath = join(this.seedDir, `${eventId}.json`);
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf8")) as SeedEvent;
  }

  listEvents(): { events: EventSummary[] } {
    if (!existsSync(this.seedDir)) return { events: [] };

    const events = readdirSync(this.seedDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => {
        const raw = readFileSync(join(this.seedDir, name), "utf8");
        const data = JSON.parse(raw) as SeedEvent;
        return {
          eventId: data.eventId,
          title: data.title,
          subtitle: data.subtitle ?? null,
          publishedAt: data.publishedAt ?? null,
        };
      })
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

    return { events };
  }

  private sortByIdOrder(
    rows: Record<string, unknown>[],
    idOrder: number[]
  ): Record<string, unknown>[] {
    const byId = new Map(rows.map((row) => [Number(row.monster_id), row] as const));
    return idOrder
      .map((id) => byId.get(id))
      .filter((row): row is Record<string, unknown> => row != null);
  }

  private manualToFamily(monsterId: number, manual: Record<string, unknown>): MonsterFamily {
    return {
      monsterId,
      baseId: monsterId,
      coverMonsterId: monsterId,
      nodes: [{ monster_id: monsterId, ...manual }],
      edges: [],
    };
  }

  async getEvent(eventId: string): Promise<EventDetail> {
    const seed = this.loadSeed(eventId);
    if (!seed) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }

    const seedEntries = this.flattenSeedEntries(seed);
    const rawEntries: EventEntryDetail[] = [];
    for (const entry of seedEntries) {
      let family: MonsterFamily;
      if (entry.monsterId != null) {
        family = await this.monsters.getMonsterFamily(entry.monsterId);
      } else if (entry.manual) {
        const manualId = Number(entry.manual.monster_id) || 0;
        family = this.manualToFamily(manualId, entry.manual);
      } else {
        continue;
      }
      rawEntries.push({
        role: entry.role,
        label: entry.label ?? null,
        note: entry.note ?? null,
        family,
      });
    }
    // New evo of a new card → one showcase card (same evolution family).
    const entries = this.mergeEntriesByFamily(rawEntries);

    let coverMonsters: Record<string, unknown>[] = [];
    if (seed.coverMonsterIds?.length) {
      // Resolve each id to its family's cover form (last stage of the
      // skill-transform chain), so the hero shows the "final form" art too.
      const resolvedIds: number[] = [];
      for (const id of seed.coverMonsterIds) {
        const family = await this.monsters.getMonsterFamily(id);
        resolvedIds.push(family.coverMonsterId);
      }
      coverMonsters = this.sortByIdOrder(
        await this.monsters.lookupMonstersByIds(resolvedIds),
        resolvedIds
      );
    }

    return {
      eventId: seed.eventId,
      title: seed.title,
      subtitle: seed.subtitle ?? null,
      publishedAt: seed.publishedAt ?? null,
      sourceUrl: seed.sourceUrl ?? null,
      coverMonsters,
      entries,
      loading: seed.loading?.theme
        ? {
            theme: seed.loading.theme,
            minMs: seed.loading.minMs,
            asset: seed.loading.asset,
          }
        : null,
    };
  }

  /** Prefer flat `entries`; legacy `sections` become labeled entries. */
  private flattenSeedEntries(seed: SeedEvent): SeedEntry[] {
    if (seed.entries?.length) return seed.entries;
    if (!seed.sections?.length) return [];
    return seed.sections.flatMap((section) =>
      section.entries.map((entry) => ({
        ...entry,
        label: entry.label ?? section.heading,
      }))
    );
  }

  /**
   * Collapse multiple seed rows that resolve to the same evolution family
   * (e.g. new monster + its new UE/assist) into a single showcase card.
   * Keeps first-seen order; prefers the higher-rarity / evo form for display.
   */
  private mergeEntriesByFamily(entries: EventEntryDetail[]): EventEntryDetail[] {
    const byBase = new Map<number, EventEntryDetail>();
    const order: number[] = [];

    for (const entry of entries) {
      const key = entry.family.baseId;
      const existing = byBase.get(key);
      if (!existing) {
        byBase.set(key, entry);
        order.push(key);
        continue;
      }
      byBase.set(key, this.pickMergedEntry(existing, entry));
    }

    return order.map((key) => byBase.get(key)!);
  }

  private pickMergedEntry(
    a: EventEntryDetail,
    b: EventEntryDetail
  ): EventEntryDetail {
    const rarityOf = (e: EventEntryDetail) => {
      const id = e.family.monsterId;
      const node = e.family.nodes.find((row) => Number(row.monster_id) === id);
      return Number(node?.rarity ?? 0);
    };
    // Prefer the form the seed pointed at when it's the rarer / evo card.
    const primary = rarityOf(b) > rarityOf(a) ? b : a;
    const secondary = primary === a ? b : a;
    const hasNewMonster =
      a.role === "new-monster" || b.role === "new-monster";
    const hasNewEvo =
      a.role === "new-evolution" || b.role === "new-evolution";

    const richerFamily =
      primary.family.nodes.length >= secondary.family.nodes.length
        ? primary.family
        : secondary.family;

    return {
      role: hasNewMonster ? "new-monster" : hasNewEvo ? "new-evolution" : primary.role,
      label: hasNewMonster
        ? a.label === "New Monster" || b.label === "New Monster"
          ? "New Monster"
          : (primary.label ?? "New Monster")
        : hasNewEvo
          ? "New Evolution"
          : primary.label,
      note: primary.note ?? secondary.note,
      family: {
        ...richerFamily,
        // Keep the preferred form as the headline id for portrait selection.
        monsterId: primary.family.monsterId,
      },
    };
  }
}
