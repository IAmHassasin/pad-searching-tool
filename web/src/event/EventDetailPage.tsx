import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AdminLaunch } from "../components/AdminLaunch";
import { PageHeader } from "../components/PageHeader";
import { monsterRowId } from "../lib/filters";
import { portraitUrl } from "../lib/portraits";
import { fetchEvent } from "./api";
import { EventHero } from "./EventHero";
import { EventLoadingGate, isLoadingThemeId } from "./loading";
import type { EventLoadingConfig } from "./loading";
import { EventMonsterCard } from "./EventMonsterCard";
import { EventMonsterModal } from "./EventMonsterModal";
import { mergeEntriesByFamily } from "./merge-entries";
import type { EventEntry } from "./types";

export function EventDetailPage({ eventId }: { eventId: string }) {
  const event = useQuery({
    queryKey: ["events", eventId],
    queryFn: () => fetchEvent(eventId),
  });
  const [openEntry, setOpenEntry] = useState<EventEntry | null>(null);
  const entries = event.data
    ? mergeEntriesByFamily(event.data.entries)
    : [];

  const loadingConfig = useMemo(
    () => resolveLoadingConfig(event.data?.loading ?? null, eventId),
    [event.data?.loading, eventId]
  );

  const preloadUrls = useMemo(() => {
    if (!event.data) return [];
    const ids = new Set<number>();
    if (!event.data.bannerArt) {
      for (const row of event.data.coverMonsters) {
        const id = Number(row.monster_id);
        if (id > 0) ids.add(id);
      }
    }
    for (const entry of entries) {
      if (entry.family.coverMonsterId > 0) ids.add(entry.family.coverMonsterId);
      if (entry.family.monsterId > 0) ids.add(entry.family.monsterId);
    }
    const heroUrls = [event.data.banner, event.data.bannerArt].filter(
      (url): url is string => !!url
    );
    return [...heroUrls, ...[...ids].map(portraitUrl).filter(Boolean)];
  }, [event.data, entries]);

  return (
    <EventLoadingGate
      config={loadingConfig}
      preloadUrls={preloadUrls}
      contentReady={!!event.data}
    >
      <div className="min-h-full bg-[var(--color-surface)] text-[var(--color-fg)]">
        <PageHeader
          title={event.data?.title ?? "Event"}
          back={{ href: "/event", label: "All events" }}
          actions={<AdminLaunch variant="chip" />}
          maxWidthClass="max-w-5xl"
        />

        {event.isLoading && !event.data && (
          <p className="p-6 text-center text-sm text-[var(--color-muted)]">
            Loading…
          </p>
        )}
        {event.isError && (
          <p className="p-6 text-center text-sm text-[var(--color-negative)]">
            {event.error instanceof Error
              ? event.error.message
              : "Failed to load"}
          </p>
        )}

        {event.data && (
          <>
            <EventHero
              title={event.data.title}
              coverMonsters={event.data.coverMonsters}
              banner={event.data.banner}
              bannerArt={event.data.bannerArt}
            />

            <main className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5">
                {entries.map((entry) => {
                  const headline =
                    entry.family.nodes.find(
                      (row) => monsterRowId(row) === entry.family.monsterId
                    ) ??
                    entry.family.nodes.find(
                      (row) =>
                        monsterRowId(row) === entry.family.coverMonsterId
                    ) ??
                    entry.family.nodes[0];
                  if (!headline) return null;
                  const portraitMonsterId =
                    entry.family.monsterId ||
                    entry.family.coverMonsterId ||
                    monsterRowId(headline);
                  return (
                    <EventMonsterCard
                      key={entry.family.baseId}
                      row={headline}
                      portraitMonsterId={portraitMonsterId}
                      label={entry.label}
                      onClick={() => setOpenEntry(entry)}
                    />
                  );
                })}
              </div>
            </main>
          </>
        )}

        {openEntry && (
          <EventMonsterModal
            family={openEntry.family}
            initialMonsterId={
              openEntry.family.monsterId || openEntry.family.coverMonsterId
            }
            onClose={() => setOpenEntry(null)}
          />
        )}
      </div>
    </EventLoadingGate>
  );
}

function resolveLoadingConfig(
  raw: { theme: string; minMs?: number; asset?: string } | null,
  eventId: string
): EventLoadingConfig | null {
  if (raw?.theme && isLoadingThemeId(raw.theme)) {
    return { theme: raw.theme, minMs: raw.minMs, asset: raw.asset };
  }
  // Fallback until API rebuild picks up seed `loading`.
  if (eventId.includes("gintama")) {
    return {
      theme: "sword-slash",
      minMs: 1400,
      asset: "/event-loading/gintama-sword.png",
    };
  }
  if (eventId.includes("conan")) {
    return { theme: "shoji-slide", minMs: 1600 };
  }
  return null;
}
