import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { MonsterDetailPanel } from "../components/MonsterDetailPanel";
import { PageHeader } from "../components/PageHeader";
import { EventMonsterCard } from "../event/EventMonsterCard";
import { monsterRowId } from "../lib/filters";
import type { MonsterRecord } from "../types";
import { fetchEggMachines, fetchMonsterRecords } from "./api";
import type { EggBadge, EggMachineEvent, EggWindow } from "./types";

type FilterId = "all" | "skip" | "jp" | "na";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "skip", label: "Might skip" },
  { id: "jp", label: "JP" },
  { id: "na", label: "NA" },
];

function formatStamp(unix: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(unix * 1000));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}

function formatWindow(window: EggWindow): string {
  const stones = window.cost === 1 ? "1 stone" : `${window.cost} stones`;
  return `${window.server} ${formatStamp(window.start)} – ${formatStamp(window.end)} · ${stones}`;
}

function matchesFilter(event: EggMachineEvent, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "skip") return event.badges.includes("Might skip");
  if (filter === "jp") return event.badges.includes("JP");
  return event.badges.includes("NA");
}

function badgeClass(badge: EggBadge): string {
  if (badge === "Might skip") {
    return "bg-[var(--color-amber-bg)] text-[var(--color-amber-text)] ring-[var(--color-amber-border)]";
  }
  if (badge === "NA") {
    return "bg-[var(--color-secondary-muted)] text-[var(--color-secondary-strong)] ring-[var(--color-secondary)]/40";
  }
  return "bg-[color-mix(in_srgb,var(--color-negative)_14%,transparent)] text-[var(--color-negative)] ring-[var(--color-negative)]/40";
}

function byRarity(a: MonsterRecord, b: MonsterRecord): number {
  const rarity = (b.rarity ?? 0) - (a.rarity ?? 0);
  if (rarity !== 0) return rarity;
  return monsterRowId(b) - monsterRowId(a);
}

function rowsFor(ids: number[], byId: Map<number, MonsterRecord>): MonsterRecord[] {
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is MonsterRecord => row != null)
    .sort(byRarity);
}

function EventNameColumn({
  label,
  events,
  openId,
  onChoose,
}: {
  label: string;
  events: EggMachineEvent[];
  openId: string | null;
  onChoose: (event: EggMachineEvent) => void;
}) {
  return (
    <ul className="flex min-w-0 flex-col gap-2" aria-label={label}>
      {events.map((event) => {
        const isOpen = event.id === openId;
        const pendingNa = !event.badges.includes("NA");
        return (
          <li key={event.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => onChoose(event)}
              className={`ds-card pressable w-full px-4 py-3 text-left ${
                pendingNa
                  ? "border-[var(--color-amber-border)]/80 bg-[color-mix(in_srgb,var(--color-accent)_22%,var(--color-panel))]! hover:bg-[color-mix(in_srgb,var(--color-accent)_32%,var(--color-panel))]!"
                  : "hover:border-white/10 hover:bg-[var(--color-hover)]"
              } ${isOpen ? "ring-2 ring-[var(--color-accent)]" : ""}`}
            >
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 font-semibold text-[var(--color-fg-strong)]">
                  {event.name}
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {event.badges.map((badge) => (
                    <span
                      key={badge}
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${badgeClass(badge)}`}
                    >
                      {badge}
                    </span>
                  ))}
                </span>
              </div>
              <div className="mt-1 space-y-0.5 font-mono text-xs text-[var(--color-faint)]">
                {event.windows.map((window) => (
                  <div key={window.server}>{formatWindow(window)}</div>
                ))}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function EggMachinesPage() {
  const list = useQuery({
    queryKey: ["egg-machines"],
    queryFn: fetchEggMachines,
  });
  const [filter, setFilter] = useState<FilterId>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<MonsterRecord | null>(null);
  const monstersRef = useRef<HTMLElement>(null);

  const events = list.data?.events ?? [];
  const visible = events.filter((event) => matchesFilter(event, filter));
  const open = visible.find((event) => event.id === openId) ?? null;
  const openIds = open ? [...open.jpOnlyIds, ...open.sharedIds] : [];

  const monsters = useQuery({
    queryKey: ["egg-machines", "monsters", open?.id ?? ""],
    queryFn: () => fetchMonsterRecords(openIds),
    enabled: openIds.length > 0,
  });

  const byId = useMemo(() => {
    const map = new Map<number, MonsterRecord>();
    for (const row of monsters.data ?? []) map.set(monsterRowId(row), row);
    return map;
  }, [monsters.data]);

  useEffect(() => {
    if (!openId || !monsters.data) return;
    monstersRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [openId, monsters.data]);

  const splitJp = Boolean(open && open.badges.includes("JP") && open.jpOnlyIds.length > 0);
  const jpRows = open && splitJp ? rowsFor(open.jpOnlyIds, byId) : [];
  const sharedRows = open
    ? rowsFor(splitJp ? open.sharedIds : [...open.jpOnlyIds, ...open.sharedIds], byId)
    : [];

  const chooseEvent = (event: EggMachineEvent) => {
    if (openId === event.id) {
      setOpenId(null);
      setSelected(null);
      return;
    }
    setOpenId(event.id);
    setSelected(null);
  };

  const chooseMonster = (row: MonsterRecord) => {
    setSelected((current) =>
      current && monsterRowId(current) === monsterRowId(row) ? null : row
    );
  };

  return (
    <div className="min-h-full bg-[var(--color-surface)] text-[var(--color-fg)]">
      <PageHeader
        title="Egg Machines"
        subtitle="2026 pools · times in UTC+7"
        maxWidthClass="max-w-7xl"
      />

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ds-pill pressable min-h-9 px-3 text-xs font-semibold ${
                filter === item.id ? "ds-pill-active" : ""
              }`}
              aria-pressed={filter === item.id}
              onClick={() => {
                setFilter(item.id);
                setSelected(null);
                if (open && !matchesFilter(open, item.id)) setOpenId(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {list.isLoading && (
          <p className="text-sm text-[var(--color-muted)]">Loading…</p>
        )}
        {list.isError && (
          <p className="text-sm text-[var(--color-negative)]">
            {list.error instanceof Error ? list.error.message : "Failed to load"}
          </p>
        )}
        {list.data && visible.length === 0 && (
          <p className="text-sm text-[var(--color-muted)]">No egg machines.</p>
        )}

        <div className="grid items-start gap-2 sm:grid-cols-2">
          <EventNameColumn
            label="Collab"
            events={visible.filter((event) => event.collab)}
            openId={open?.id ?? null}
            onChoose={chooseEvent}
          />
          <EventNameColumn
            label="Other"
            events={visible.filter((event) => !event.collab)}
            openId={open?.id ?? null}
            onChoose={chooseEvent}
          />
        </div>

        {open && (
          <section
            ref={monstersRef}
            className="mt-4 scroll-mt-4"
            aria-label={`${open.name} monsters`}
          >
            {monsters.isLoading && (
              <p className="text-sm text-[var(--color-muted)]">Loading monsters…</p>
            )}
            {monsters.isError && (
              <p className="text-sm text-[var(--color-negative)]">
                {monsters.error instanceof Error
                  ? monsters.error.message
                  : "Failed to load monsters"}
              </p>
            )}
            {monsters.data && (
              <div className="flex flex-col gap-4 min-[900px]:flex-row min-[900px]:items-start">
                <div className="min-w-0 flex-1 space-y-4">
                  {splitJp && (
                    <MonsterSection
                      title="JP only"
                      rows={jpRows}
                      selectedId={selected ? monsterRowId(selected) : null}
                      onSelect={chooseMonster}
                      inset
                    />
                  )}
                  {sharedRows.length > 0 && (
                    <MonsterSection
                      title={splitJp ? "Also on NA" : null}
                      rows={sharedRows}
                      selectedId={selected ? monsterRowId(selected) : null}
                      onSelect={chooseMonster}
                    />
                  )}
                </div>
                {selected && (
                  <aside className="w-full min-[900px]:sticky min-[900px]:top-4 min-[900px]:max-h-[calc(100vh-2rem)] min-[900px]:w-[360px] min-[900px]:overflow-y-auto">
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        className="ds-pill pressable min-h-8 px-3 text-xs font-semibold"
                        onClick={() => setSelected(null)}
                      >
                        Close
                      </button>
                    </div>
                    <MonsterDetailPanel
                      row={selected}
                      onSelect={setSelected}
                    />
                  </aside>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function MonsterSection({
  title,
  rows,
  selectedId,
  onSelect,
  inset = false,
}: {
  title: string | null;
  rows: MonsterRecord[];
  selectedId: number | null;
  onSelect: (row: MonsterRecord) => void;
  inset?: boolean;
}) {
  return (
    <div className={inset ? "rounded-xl bg-[var(--color-inset)] p-3" : undefined}>
      {title && (
        <h2 className="ds-label mb-2 text-[11px] text-[var(--color-fg)]">{title}</h2>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2">
        {rows.map((row) => {
          const id = monsterRowId(row);
          return (
            <EventMonsterCard
              key={id}
              row={row}
              selected={selectedId === id}
              onClick={() => onSelect(row)}
            />
          );
        })}
      </div>
    </div>
  );
}
