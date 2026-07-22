import type { MonsterRecord } from "../types";
import type { EventLoadingConfig } from "./loading/types";

export type { EventLoadingConfig, EventLoadingThemeId } from "./loading/types";

export type EventEntryRole = "new-monster" | "new-evolution" | "returning";

export type EventSummary = {
  eventId: string;
  title: string;
  subtitle: string | null;
  publishedAt: string | null;
};

export type EventListResponse = {
  events: EventSummary[];
};

export type MonsterFamilyEdge = {
  from: number;
  to: number;
  kind: "evolution" | "transform";
};

export type MonsterFamily = {
  monsterId: number;
  baseId: number;
  /** Last stage of the skill-transform chain — use for thumbnail/cover art. */
  coverMonsterId: number;
  nodes: MonsterRecord[];
  edges: MonsterFamilyEdge[];
};

export type EventEntry = {
  role: EventEntryRole;
  /** Card badge text (former section/category heading). */
  label: string | null;
  note: string | null;
  family: MonsterFamily;
};

export type EventDetail = EventSummary & {
  sourceUrl: string | null;
  coverMonsters: MonsterRecord[];
  entries: EventEntry[];
  /** Optional intro loader theme (from seed `loading`). */
  loading: EventLoadingConfig | null;
};
