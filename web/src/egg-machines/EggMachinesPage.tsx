import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { MonsterPortrait } from "../components/MonsterPortrait";
import { PageHeader } from "../components/PageHeader";
import { EventMonsterModal } from "../event/EventMonsterModal";
import type { MonsterFamily } from "../event/types";
import { monsterRowId } from "../lib/filters";
import type { MonsterRecord } from "../types";
import { fetchEggMachines, fetchMonsterRecords } from "./api";
import { cryptoRandomInt, formatPublishedPercent, rollMany } from "./roll";
import type { EggBadge, EggCardRate, EggMachineEvent, EggServer, EggWindow } from "./types";

type FilterId = "all" | "skip" | "jp" | "na";

const MULTI_ROLL = 5;

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

function stoneCostLabel(cost: number, pulls: number): string | null {
  const stones = cost * pulls;
  if (!Number.isInteger(stones) || stones <= 0) return null;
  return stones === 1 ? "1 stone" : `${stones} stones`;
}

function rollServerFor(event: EggMachineEvent, pick: EggServer): EggServer {
  const available = new Set(event.windows.map((window) => window.server));
  if (available.has(pick)) return pick;
  if (available.has("NA")) return "NA";
  return "JP";
}

function byRarity(a: MonsterRecord, b: MonsterRecord): number {
  const rarity = (b.rarity ?? 0) - (a.rarity ?? 0);
  if (rarity !== 0) return rarity;
  return monsterRowId(b) - monsterRowId(a);
}

function familyFor(row: MonsterRecord): MonsterFamily {
  const id = monsterRowId(row);
  return {
    monsterId: id,
    baseId: id,
    coverMonsterId: id,
    nodes: [row],
    edges: [],
  };
}

function rowsFor(ids: number[], byId: Map<number, MonsterRecord>): MonsterRecord[] {
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is MonsterRecord => row != null)
    .sort(byRarity);
}

function MachineColumns({
  collab,
  other,
  openId,
  onChoose,
}: {
  collab: EggMachineEvent[];
  other: EggMachineEvent[];
  openId: string | null;
  onChoose: (event: EggMachineEvent) => void;
}) {
  if (collab.length === 0 && other.length === 0) return null;
  return (
    <div className="grid items-start gap-2 sm:grid-cols-2">
      <EventNameColumn label="Collab" events={collab} openId={openId} onChoose={onChoose} />
      <EventNameColumn label="Other" events={other} openId={openId} onChoose={onChoose} />
    </div>
  );
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
  const [openMonster, setOpenMonster] = useState<MonsterRecord | null>(null);
  const [serverPick, setServerPick] = useState<EggServer>("NA");
  const [pulls, setPulls] = useState<EggCardRate[]>([]);
  const monstersRef = useRef<HTMLElement>(null);

  const events = list.data?.events ?? [];
  const visible = events.filter((event) => matchesFilter(event, filter));
  const collabEvents = visible.filter((event) => event.collab);
  const otherEvents = visible.filter((event) => !event.collab);
  const open = visible.find((event) => event.id === openId) ?? null;
  const selectedRow = open
    ? Math.max(
        collabEvents.findIndex((event) => event.id === open.id),
        otherEvents.findIndex((event) => event.id === open.id)
      )
    : -1;
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
    monstersRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [openId, monsters.data]);

  const splitJp = Boolean(open && open.badges.includes("JP") && open.jpOnlyIds.length > 0);
  const jpRows = open && splitJp ? rowsFor(open.jpOnlyIds, byId) : [];
  const sharedRows = open
    ? rowsFor(splitJp ? open.sharedIds : [...open.jpOnlyIds, ...open.sharedIds], byId)
    : [];

  const server = open ? rollServerFor(open, serverPick) : "NA";
  const rateTable = open?.rates?.[server] ?? [];
  const totalWeight = rateTable.reduce(
    (sum, entry) => sum + (entry.weight > 0 ? entry.weight : 0),
    0
  );
  const rollCost = open?.windows.find((window) => window.server === server)?.cost ?? 0;
  const weightById = new Map(rateTable.map((entry) => [entry.monsterId, entry.weight]));
  const bothServers = (open?.windows.length ?? 0) > 1;
  const canRoll = totalWeight > 0 && Boolean(monsters.data);

  const chooseEvent = (event: EggMachineEvent) => {
    setServerPick("NA");
    setPulls([]);
    setOpenMonster(null);
    if (openId === event.id) {
      setOpenId(null);
      return;
    }
    setOpenId(event.id);
  };

  const chooseServer = (next: EggServer) => {
    setServerPick(next);
    setPulls([]);
    setOpenMonster(null);
  };

  const draw = (count: number) => {
    if (!canRoll) return;
    setPulls(rollMany(rateTable, count, cryptoRandomInt));
  };

  const openDetail = (row: MonsterRecord) => {
    setOpenMonster(row);
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
                setOpenMonster(null);
                if (open && !matchesFilter(open, item.id)) {
                  setOpenId(null);
                  setPulls([]);
                  setServerPick("NA");
                }
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

        <MachineColumns
          collab={selectedRow >= 0 ? collabEvents.slice(0, selectedRow + 1) : collabEvents}
          other={selectedRow >= 0 ? otherEvents.slice(0, selectedRow + 1) : otherEvents}
          openId={open?.id ?? null}
          onChoose={chooseEvent}
        />

        {open && (
          <section
            ref={monstersRef}
            className="my-2 scroll-mt-4"
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
              <div className="grid items-start gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-4" role="region" aria-label="Lineup">
                  {splitJp && (
                    <IconLineup
                      title="JP only"
                      rows={jpRows}
                      weightById={weightById}
                      onOpen={openDetail}
                      inset
                    />
                  )}
                  {sharedRows.length > 0 && (
                    <IconLineup
                      title={splitJp ? "Also on NA" : "Lineup"}
                      rows={sharedRows}
                      weightById={weightById}
                      onOpen={openDetail}
                    />
                  )}
                </div>
                <GachaSimulator
                  name={open.name}
                  server={server}
                  bothServers={bothServers}
                  canRoll={canRoll}
                  rollCost={rollCost}
                  ratesMissing={Boolean(monsters.data) && totalWeight <= 0}
                  pulls={pulls}
                  byId={byId}
                  onServer={chooseServer}
                  onRoll={draw}
                  onOpen={openDetail}
                />
              </div>
            )}
          </section>
        )}

        {selectedRow >= 0 && (
          <MachineColumns
            collab={collabEvents.slice(selectedRow + 1)}
            other={otherEvents.slice(selectedRow + 1)}
            openId={open?.id ?? null}
            onChoose={chooseEvent}
          />
        )}
      </main>
      {openMonster && (
        <EventMonsterModal
          family={familyFor(openMonster)}
          initialMonsterId={monsterRowId(openMonster)}
          onClose={() => setOpenMonster(null)}
        />
      )}
    </div>
  );
}

function IconLineup({
  title,
  rows,
  weightById,
  onOpen,
  inset = false,
}: {
  title: string | null;
  rows: MonsterRecord[];
  weightById: Map<number, number>;
  onOpen: (row: MonsterRecord) => void;
  inset?: boolean;
}) {
  return (
    <div className={inset ? "rounded-xl bg-[var(--color-inset)] p-3" : undefined}>
      {title && (
        <h2 className="ds-label mb-2 text-[11px] text-[var(--color-fg)]">{title}</h2>
      )}
      <div className="flex flex-wrap gap-2">
        {rows.map((row) => {
          const id = monsterRowId(row);
          const weight = weightById.get(id);
          return (
            <MonsterIconButton
              key={id}
              row={row}
              percent={weight != null ? formatPublishedPercent(weight) : null}
              onOpen={onOpen}
            />
          );
        })}
      </div>
    </div>
  );
}

function MonsterIconButton({
  row,
  percent,
  onOpen,
}: {
  row: MonsterRecord;
  percent: string | null;
  onOpen: (row: MonsterRecord) => void;
}) {
  const id = monsterRowId(row);
  const name = row.name_en?.trim() || row.name_jp?.trim() || `Monster ${id}`;
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      aria-label={percent ? `${name}, ${percent}` : name}
      title={name}
      className="pressable flex w-14 flex-col items-center gap-1"
    >
      <span className="h-14 w-14 overflow-hidden rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-inset)]">
        <MonsterPortrait
          monsterId={id}
          alt=""
          variant="icon"
          className="h-full w-full object-cover"
        />
      </span>
      {percent && (
        <span className="font-mono text-[10px] leading-none text-[var(--color-faint)]">
          {percent}
        </span>
      )}
    </button>
  );
}

function GachaSimulator({
  name,
  server,
  bothServers,
  canRoll,
  rollCost,
  ratesMissing,
  pulls,
  byId,
  onServer,
  onRoll,
  onOpen,
}: {
  name: string;
  server: EggServer;
  bothServers: boolean;
  canRoll: boolean;
  rollCost: number;
  ratesMissing: boolean;
  pulls: EggCardRate[];
  byId: Map<number, MonsterRecord>;
  onServer: (server: EggServer) => void;
  onRoll: (count: number) => void;
  onOpen: (row: MonsterRecord) => void;
}) {
  return (
    <aside
      className="ds-card min-[900px]:sticky min-[900px]:top-4 p-4"
      aria-label="Gacha simulator"
    >
      <h2 className="text-sm font-semibold text-[var(--color-fg-strong)]">Gacha simulator</h2>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{name}</p>
      {bothServers && (
        <div className="mt-3 flex gap-1.5">
          {(["JP", "NA"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`ds-pill pressable min-h-9 px-3 text-xs font-semibold ${
                server === option ? "ds-pill-active" : ""
              }`}
              aria-pressed={server === option}
              onClick={() => onServer(option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <RollButton
          count={1}
          cost={rollCost}
          disabled={!canRoll}
          onRoll={onRoll}
        />
        <RollButton
          count={MULTI_ROLL}
          cost={rollCost}
          disabled={!canRoll}
          onRoll={onRoll}
        />
      </div>
      {ratesMissing && (
        <p className="mt-3 text-sm text-[var(--color-muted)]">Rates unavailable for this machine.</p>
      )}
      {pulls.length > 0 && (
        <div className="mt-4" role="region" aria-label="Roll results">
          <h3 className="ds-label mb-2 text-[11px] text-[var(--color-fg)]">Results</h3>
          <div className="flex flex-wrap gap-2">
            {pulls.map((pull, index) => {
              const row = byId.get(pull.monsterId);
              const percent = formatPublishedPercent(pull.weight);
              if (!row) {
                return (
                  <p
                    key={`${pull.monsterId}-${index}`}
                    className="font-mono text-xs text-[var(--color-faint)]"
                  >
                    #{pull.monsterId} · {percent}
                  </p>
                );
              }
              return (
                <MonsterIconButton
                  key={`${pull.monsterId}-${index}`}
                  row={row}
                  percent={percent}
                  onOpen={onOpen}
                />
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

function RollButton({
  count,
  cost,
  disabled,
  onRoll,
}: {
  count: number;
  cost: number;
  disabled: boolean;
  onRoll: (count: number) => void;
}) {
  const stones = stoneCostLabel(cost, count);
  return (
    <button
      type="button"
      className="ds-btn-primary pressable flex min-h-16 flex-col items-center justify-center px-2 py-2 disabled:pointer-events-none"
      disabled={disabled}
      onClick={() => onRoll(count)}
    >
      <span className="text-xl leading-none">×{count}</span>
      {stones && <span className="mt-1 text-[11px] font-semibold">{stones}</span>}
    </button>
  );
}
