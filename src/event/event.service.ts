import { Injectable, NotFoundException } from "@nestjs/common";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { matchGroupByEventName } from "../admin/event-catalog-parse";
import { MonsterRelationsService } from "../api/monster-relations.service";
import {
  buildGroupShowcase,
  familyIdsFromNodes,
} from "./event-group-showcase";
import { loadFamilyOrNull, fallbackMonsterFamily } from "./skip-missing-monster";

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
  groupId?: number | null;
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

  async getEvent(eventId: string): Promise<EventDetail> {
    const seed = this.loadSeed(eventId);
    if (!seed) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }

    const seedEntries = this.flattenSeedEntries(seed);
    const groupId = await this.resolveGroupId(seed, seedEntries);
    const members: Array<{ monsterId: number; family: MonsterFamily }> = [];
    const seenBases = new Set<number>();

    if (groupId) {
      const collab = await this.monsters.getCollabGroupByGroupId(groupId);
      for (const bucket of collab.byRarity) {
        for (const row of bucket.monsters) {
          const id = Number(row.monster_id);
          if (!Number.isFinite(id) || id <= 0) continue;
          const family = await this.familyFor(id);
          if (seenBases.has(family.baseId)) continue;
          seenBases.add(family.baseId);
          members.push({
            monsterId: family.coverMonsterId || family.monsterId,
            family,
          });
        }
      }
    }

    for (const entry of [...seedEntries].reverse()) {
      if (entry.monsterId == null) continue;
      const family = await this.familyFor(entry.monsterId);
      if (seenBases.has(family.baseId)) continue;
      seenBases.add(family.baseId);
      members.unshift({ monsterId: entry.monsterId, family });
    }

    const showcase = buildGroupShowcase(
      members.map((member) => ({
        monsterId: member.monsterId,
        familyIds: familyIdsFromNodes(
          member.family.monsterId,
          member.family.coverMonsterId,
          member.family.baseId,
          member.family.nodes
        ),
      })),
      seedEntries
        .filter((entry) => entry.monsterId != null)
        .map((entry) => ({
          monsterId: entry.monsterId as number,
          role: entry.role,
          label: entry.label ?? null,
          note: entry.note ?? null,
        }))
    );

    const familyById = new Map(
      members.map((member) => [member.monsterId, member.family] as const)
    );
    const entries: EventEntryDetail[] = showcase.map((card) => ({
      role: card.role,
      label: card.label,
      note: card.note,
      family: familyById.get(card.monsterId)!,
    }));

    let coverMonsters: Record<string, unknown>[] = [];
    const coverIds = seed.coverMonsterIds?.length
      ? seed.coverMonsterIds
      : showcase
          .filter((card) => card.isNew)
          .concat(showcase)
          .map((card) => familyById.get(card.monsterId)?.coverMonsterId ?? card.monsterId)
          .filter((id, i, all) => all.indexOf(id) === i)
          .slice(0, 6);

    if (coverIds.length) {
      const resolvedIds: number[] = [];
      for (const id of coverIds) {
        const family = await loadFamilyOrNull(
          (coverId) => this.monsters.getMonsterFamily(coverId),
          id
        );
        resolvedIds.push(family?.coverMonsterId ?? id);
      }
      const fetched = await this.monsters.lookupMonstersByIds(resolvedIds);
      const byId = new Map(
        fetched.map((row) => [Number(row.monster_id), row] as const)
      );
      coverMonsters = resolvedIds.map(
        (id) => byId.get(id) ?? { monster_id: id }
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

  private async familyFor(monsterId: number): Promise<MonsterFamily> {
    const loaded = await loadFamilyOrNull(
      (id) => this.monsters.getMonsterFamily(id),
      monsterId
    );
    return loaded ?? fallbackMonsterFamily(monsterId);
  }

  private async resolveGroupId(
    seed: SeedEvent,
    seedEntries: SeedEntry[]
  ): Promise<number> {
    const title = seed.title;
    const matchesTitle = (groupId: number, groupName: string | null) =>
      matchGroupByEventName(title, [{ groupId, groupName }])?.groupId ===
      groupId;

    if (seed.groupId && seed.groupId > 0) {
      try {
        const collab = await this.monsters.getCollabGroupByGroupId(seed.groupId);
        if (matchesTitle(collab.groupId, collab.groupName)) return collab.groupId;
      } catch {
        // fall through to name / seed lookup
      }
    }
    try {
      const groups = await this.monsters.listCollabGroups();
      const matched = matchGroupByEventName(title, groups);
      if (matched?.groupId) return matched.groupId;
    } catch {
      // series table may be missing in tests / empty DBs
    }
    for (const entry of seedEntries) {
      if (entry.monsterId == null) continue;
      try {
        const collab = await this.monsters.getCollabGroup(entry.monsterId);
        if (collab.groupId && matchesTitle(collab.groupId, collab.groupName)) {
          return collab.groupId;
        }
      } catch {
        continue;
      }
    }
    return 0;
  }
}
