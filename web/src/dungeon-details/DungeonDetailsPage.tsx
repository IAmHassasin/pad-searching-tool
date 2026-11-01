import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLaunch } from "../components/AdminLaunch";
import { MonsterPortrait } from "../components/MonsterPortrait";
import { PageHeader } from "../components/PageHeader";
import { fetchDungeon, type EnglishGlossary } from "./api";
import {
  classifyEffects,
  effectInScope,
  floorIsDim,
  floorMatchCount,
  spawnHasGimmick,
  type GimmickScope,
} from "./gimmick-filter";
import type { DungeonFloor, DungeonSpawn, GimmickChip } from "./types";
import {
  translateGimmick,
  translateLine,
  translatePartLabel,
  translateSpawnNote,
  translateTag,
  translateTitle,
  translateType,
} from "./translate";
import { formatPadStatM } from "./utils";
import { useEnglishGlossary } from "./useEnglishGlossary";

const SCOPES: { id: GimmickScope; label: string }[] = [
  { id: "pre", label: "On entry" },
  { id: "super-resolve", label: "Super Resolve" },
  { id: "all", label: "All moves" },
];

function gimmickLabel(g: GimmickChip, glossary: EnglishGlossary | undefined) {
  return glossary ? translateGimmick(g.id, g.labelJa, glossary) : g.labelJa;
}

function GimmickChipButton({
  chip,
  glossary,
  selected,
  onToggle,
}: {
  chip: GimmickChip;
  glossary: EnglishGlossary | undefined;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const label = gimmickLabel(chip, glossary);
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={label}
      onClick={() => onToggle(chip.id)}
      className={`pressable inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-left text-xs ${
        selected ? "ds-pill-active" : "ds-pill"
      }`}
    >
      <img
        src={chip.iconUrl}
        alt=""
        className="h-5 w-5 shrink-0 object-contain"
        loading="lazy"
      />
      <span className="min-w-0 break-words">{label}</span>
    </button>
  );
}

function GimmickFilterBar({
  required,
  notable,
  glossary,
  selectedId,
  scope,
  onToggle,
  onScope,
  onOpenList,
}: {
  required: GimmickChip[];
  notable: GimmickChip[];
  glossary: EnglishGlossary | undefined;
  selectedId: string | null;
  scope: GimmickScope;
  onToggle: (id: string) => void;
  onScope: (scope: GimmickScope) => void;
  onOpenList: () => void;
}) {
  return (
    <div className="sticky top-[52px] z-30 mb-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 py-2.5 backdrop-blur-md">
      <GimmickChipRow
        title="Required mechanics"
        chips={required}
        glossary={glossary}
        selectedId={selectedId}
        onToggle={onToggle}
      />
      <GimmickChipRow
        title="Notable mechanics"
        chips={notable}
        glossary={glossary}
        selectedId={selectedId}
        onToggle={onToggle}
      />
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {selectedId && (
          <div
            role="radiogroup"
            aria-label="Where the mechanic applies"
            className="flex flex-wrap gap-1.5"
          >
            {SCOPES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={scope === item.id}
                onClick={() => onScope(item.id)}
                className={`pressable rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  scope === item.id ? "ds-pill-active" : "ds-pill"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onOpenList}
          className="pressable ds-btn ml-auto px-2.5 py-1 text-[11px] font-semibold"
        >
          Gimmick list
        </button>
      </div>
    </div>
  );
}

function GimmickChipRow({
  title,
  chips,
  glossary,
  selectedId,
  onToggle,
}: {
  title: string;
  chips: GimmickChip[];
  glossary: EnglishGlossary | undefined;
  selectedId: string | null;
  onToggle: (id: string) => void;
}) {
  if (!chips.length) return null;
  return (
    <div className="mb-2">
      <h2 className="ds-label mb-1">{title}</h2>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((chip) => (
          <GimmickChipButton
            key={chip.id}
            chip={chip}
            glossary={glossary}
            selected={chip.id === selectedId}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

function GimmickListSheet({
  required,
  notable,
  glossary,
  selectedId,
  onToggle,
  onClose,
}: {
  required: GimmickChip[];
  notable: GimmickChip[];
  glossary: EnglishGlossary | undefined;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const groups = [
    { title: "Required mechanics", chips: required },
    { title: "Notable mechanics", chips: notable },
  ].filter((group) => group.chips.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close gimmick list"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gimmick-sheet-title"
        className="ds-float animate-sheet-in relative flex max-h-[min(70dvh,36rem)] w-full max-w-6xl flex-col rounded-t-3xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <h2 id="gimmick-sheet-title" className="text-sm font-bold text-[var(--color-fg-strong)]">
            Gimmicks
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="pressable ds-btn px-2.5 py-1 text-xs font-semibold"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {groups.map((group) => (
            <section key={group.title}>
              <h3 className="ds-label mb-2">{group.title}</h3>
              <div className="flex flex-wrap gap-2">
                {group.chips.map((chip) => (
                  <GimmickChipButton
                    key={chip.id}
                    chip={chip}
                    glossary={glossary}
                    selected={chip.id === selectedId}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpawnCell({
  spawn,
  glossary,
  layout = "column",
}: {
  spawn: DungeonSpawn;
  glossary: EnglishGlossary | undefined;
  layout?: "column" | "row";
}) {
  const displayName =
    spawn.nameEn?.trim() ||
    (spawn.monsterId != null ? `#${spawn.monsterId}` : "Unknown monster");

  const hp = spawn.hp ? formatPadStatM(spawn.hp) : null;
  const def = spawn.defense ? formatPadStatM(spawn.defense) : null;

  const portrait =
    spawn.monsterId != null ? (
      <MonsterPortrait
        monsterId={spawn.monsterId}
        variant="icon"
        alt={displayName}
        className={`h-12 w-12 shrink-0 object-contain ${
          layout === "column" ? "mx-auto" : ""
        }`}
      />
    ) : null;

  const details = (
    <div className="min-w-0 space-y-1">
      <div
        className="break-words font-semibold text-[var(--color-fg-strong)]"
        title={displayName}
      >
        {displayName}
      </div>
      {spawn.monsterId != null && (
        <div>
          <span className="inline-block rounded-md bg-[var(--color-inset)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--color-accent-strong)] ring-1 ring-[var(--color-accent)]/20">
            #{spawn.monsterId}
          </span>
        </div>
      )}
      {spawn.types.length > 0 && (
        <div className="text-xs text-[var(--color-muted)]">
          {spawn.types
            .map((t) => (glossary ? translateType(t, glossary) : t))
            .join(" · ")}
        </div>
      )}
      {(hp || def) && (
        <div className="font-mono text-xs tabular-nums text-[var(--color-fg)]">
          {hp && <div>HP: {hp}</div>}
          {def && <div>DEF: {def}</div>}
        </div>
      )}
      {spawn.parts?.map((p) => {
        const partHp = p.hp ? formatPadStatM(p.hp) : null;
        const partDef = p.defense ? formatPadStatM(p.defense) : null;
        return (
        <div
          key={p.label}
          className="break-words font-mono text-xs tabular-nums text-[var(--color-muted)]"
        >
          [{glossary ? translatePartLabel(p.label, glossary) : p.label}]{" "}
          {partHp && `HP: ${partHp}`} {partDef && `DEF: ${partDef}`}
        </div>
      );
      })}
    </div>
  );

  if (layout === "row") {
    return (
      <div className="flex items-start gap-3 text-sm">
        {portrait}
        {details}
      </div>
    );
  }

  return (
    <div className="space-y-1 text-sm">
      {portrait}
      {details}
    </div>
  );
}

function EffectLines({
  spawn,
  gimmicks,
  glossary,
  selectedId,
  scope,
}: {
  spawn: DungeonSpawn;
  gimmicks: Map<string, GimmickChip>;
  glossary: EnglishGlossary | undefined;
  selectedId: string | null;
  scope: GimmickScope;
}) {
  const phases = classifyEffects(spawn.effects);
  const spawnMatches =
    selectedId == null || spawnHasGimmick(spawn.effects, selectedId, scope);
  return (
    <ul className="space-y-1.5 text-sm leading-relaxed">
      {spawn.effects.map((effect, i) => {
        const en = glossary ? translateLine(effect.raw, glossary) : effect.raw;
        const dimLine =
          selectedId != null &&
          spawnMatches &&
          !effectInScope(phases[i] ?? "pre", scope);
        return (
          <li
            key={i}
            className={dimLine ? "opacity-40 transition-opacity" : "transition-opacity"}
          >
            <div className="break-words">{en}</div>
            {(effect.tags.length > 0 || effect.gimmickIds.length > 0) && (
              <div className="mt-0.5 flex flex-wrap gap-1">
                {effect.tags.map((tag) => {
                  const tagEn = glossary ? translateTag(tag, glossary) : tag;
                  return (
                  <span
                    key={tag}
                    className="rounded bg-[var(--color-secondary-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-secondary-strong)]"
                    title={tagEn}
                  >
                    {tagEn}
                  </span>
                );
                })}
                {effect.gimmickIds.map((id) => {
                  const g = gimmicks.get(id);
                  const gimmickLabel =
                    g && glossary
                      ? translateGimmick(g.id, g.labelJa, glossary)
                      : (g?.labelJa ?? id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded bg-[var(--color-amber-bg)] px-2 py-1 text-xs text-[var(--color-amber-text)] ring-1 ring-[var(--color-amber-border)]/40"
                      title={gimmickLabel}
                    >
                      {g?.iconUrl && (
                        <img
                          src={g.iconUrl}
                          alt=""
                          className="h-6 w-6 shrink-0 object-contain"
                        />
                      )}
                      {gimmickLabel}
                    </span>
                  );
                })}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function scrollToFloor(floor: string) {
  const nodes = document.querySelectorAll<HTMLElement>(
    `[data-floor="${CSS.escape(floor)}"]`,
  );
  const target = [...nodes].find((el) => el.getClientRects().length > 0);
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function FloorMinimap({
  floors,
  glossary,
  selectedId,
  scope,
  activeFloor,
  onJump,
}: {
  floors: DungeonFloor[];
  glossary: EnglishGlossary | undefined;
  selectedId: string | null;
  scope: GimmickScope;
  activeFloor: string | null;
  onJump: (floor: string) => void;
}) {
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !activeFloor) return;
    const button = rail.querySelector<HTMLButtonElement>(
      `[data-minimap="${CSS.escape(activeFloor)}"]`,
    );
    if (!button) return;
    const top =
      button.offsetTop - rail.clientHeight / 2 + button.offsetHeight / 2;
    rail.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [activeFloor]);

  return (
    <nav
      ref={railRef}
      aria-label="Floors"
      className="sticky top-[52px] z-20 flex max-h-[calc(100dvh-3.5rem)] w-12 shrink-0 flex-col gap-1 overflow-y-auto pr-1 sm:w-14"
    >
      <p className="ds-label px-0.5">Floors</p>
      {floors.map((floor) => {
        const dim = floorIsDim(floor.spawns, selectedId, scope);
        const matches = floorMatchCount(floor.spawns, selectedId, scope);
        const label = glossary
          ? translateLine(floor.floor, glossary)
          : floor.floor;
        const current = floor.floor === activeFloor;
        return (
          <button
            key={floor.floor}
            type="button"
            data-minimap={floor.floor}
            aria-current={current ? "location" : undefined}
            title={
              selectedId
                ? `${label}: ${matches} matching`
                : label
            }
            onClick={() => onJump(floor.floor)}
            className={`pressable rounded-md px-0.5 py-1 text-center transition-opacity ${
              dim ? "opacity-40" : ""
            } ${
              current
                ? "bg-[var(--color-accent-muted)] ring-1 ring-[var(--color-accent)]/60"
                : "hover:bg-[var(--color-hover)]"
            }`}
          >
            <span
              className={`mx-auto mb-0.5 block h-1 w-4 rounded-full ${
                dim ? "bg-[var(--color-faint)]" : "bg-[var(--color-accent)]"
              }`}
              aria-hidden
            />
            <span
              className={`block font-mono text-[10px] leading-tight font-bold break-words ${
                current
                  ? "text-[var(--color-accent-strong)]"
                  : "text-[var(--color-fg-strong)]"
              }`}
            >
              {label}
            </span>
            {selectedId && (
              <span className="font-mono text-[9px] tabular-nums text-[var(--color-muted)]">
                {matches}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function FloorCards({
  floors,
  gimmicks,
  glossary,
  selectedId,
  scope,
}: {
  floors: DungeonFloor[];
  gimmicks: Map<string, GimmickChip>;
  glossary: EnglishGlossary | undefined;
  selectedId: string | null;
  scope: GimmickScope;
}) {
  return (
    <div className="space-y-3 md:hidden">
      {floors.map((floor) => {
        const spawnDims = floor.spawns.map(
          (spawn) =>
            selectedId != null &&
            !spawnHasGimmick(spawn.effects, selectedId, scope),
        );
        const floorDim = floorIsDim(floor.spawns, selectedId, scope);
        return (
        <article
          key={floor.floor}
          data-floor={floor.floor}
          className={`ds-card scroll-mt-44 overflow-hidden transition-opacity ${
            floorDim ? "opacity-40" : ""
          }`}
        >
          <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[var(--color-border)] bg-[var(--color-hover)]/60 px-3 py-2.5">
            <h3 className="font-semibold text-[var(--color-fg-strong)]">
              {glossary ? translateLine(floor.floor, glossary) : floor.floor}
            </h3>
            {floor.spawnNote && (
              <p className="text-xs text-[var(--color-muted)]">
                {glossary
                  ? translateSpawnNote(floor.spawnNote, glossary)
                  : floor.spawnNote}
              </p>
            )}
          </header>
          <div className="divide-y divide-[var(--color-border)]">
            {floor.spawns.map((spawn, spawnIdx) => (
              <div
                key={spawnIdx}
                className={`space-y-2 px-3 py-3 transition-opacity ${
                  !floorDim && spawnDims[spawnIdx] ? "opacity-40" : ""
                }`}
              >
                <SpawnCell spawn={spawn} glossary={glossary} layout="row" />
                <EffectLines
                  spawn={spawn}
                  gimmicks={gimmicks}
                  glossary={glossary}
                  selectedId={selectedId}
                  scope={scope}
                />
              </div>
            ))}
          </div>
        </article>
        );
      })}
    </div>
  );
}

export function DungeonDetailsPage({ postId }: { postId: string }) {
  const dungeon = useQuery({
    queryKey: ["dungeon-details", postId],
    queryFn: () => fetchDungeon(postId),
  });
  const glossaryQuery = useEnglishGlossary();
  const glossary = glossaryQuery.data;
  const translationsReady = glossaryQuery.isSuccess && glossary != null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scope, setScope] = useState<GimmickScope>("pre");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeFloor, setActiveFloor] = useState<string | null>(null);
  const [loadedPostId, setLoadedPostId] = useState(postId);
  if (loadedPostId !== postId) {
    setLoadedPostId(postId);
    setSelectedId(null);
    setScope("pre");
    setSheetOpen(false);
    setActiveFloor(null);
  }

  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSheetOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  useEffect(() => {
    if (!translationsReady || !dungeon.data) return;
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-floor]")];
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const floor =
          visible?.target instanceof HTMLElement
            ? visible.target.dataset.floor
            : undefined;
        if (floor) setActiveFloor(floor);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.25, 0.5] },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [translationsReady, dungeon.data]);

  function toggleGimmick(id: string) {
    setSelectedId((current) => (current === id ? null : id));
    setSheetOpen(false);
  }

  const allGimmicks = new Map(
    [
      ...(dungeon.data?.requiredGimmicks ?? []),
      ...(dungeon.data?.cautionGimmicks ?? []),
    ].map((g) => [g.id, g])
  );

  const title =
    dungeon.data?.titleEn ??
    (dungeon.data && glossary
      ? translateTitle(dungeon.data.titleJa, glossary, dungeon.data.appmediaPostId)
      : dungeon.data?.titleJa.replace(/^【パズドラ】/, ""));

  return (
    <div className="min-h-full bg-[var(--color-surface)] text-[var(--color-fg)]">
      <PageHeader
        title={title || "Dungeon details"}
        subtitle={title ? "Dungeon details" : undefined}
        back={{ href: "/dungeon-details", label: "All dungeons" }}
        actions={<AdminLaunch variant="chip" />}
        maxWidthClass="max-w-6xl"
      >
        {dungeon.data && (
          <div className="space-y-1">
            {/* Full title on mobile, where the app bar truncates it. */}
            <p className="text-sm leading-snug font-semibold text-[var(--color-fg-strong)] sm:hidden">
              {title}
            </p>
            <p className="font-mono text-xs text-[var(--color-muted)]">
              <a
                href={dungeon.data.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="font-sans font-semibold text-[var(--color-accent-strong)] hover:underline"
              >
                AppMedia source
              </a>
              {" · "}
              imported {dungeon.data.importedAt.slice(0, 10)}
            </p>
          </div>
        )}
      </PageHeader>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {dungeon.isLoading && (
          <p className="text-sm text-[var(--color-muted)]">Loading…</p>
        )}
        {dungeon.data && glossaryQuery.isLoading && (
          <p className="text-sm text-[var(--color-muted)]">Loading translations…</p>
        )}
        {dungeon.data && glossaryQuery.isError && (
          <p className="text-sm text-[var(--color-negative)]">
            Failed to load English translations.
          </p>
        )}
        {dungeon.isError && (
          <p className="text-sm text-[var(--color-negative)]">
            {dungeon.error instanceof Error
              ? dungeon.error.message
              : "Failed to load"}
          </p>
        )}

        {dungeon.data && translationsReady && (
          <div className="flex items-start gap-2">
            <FloorMinimap
              floors={dungeon.data.floors}
              glossary={glossary}
              selectedId={selectedId}
              scope={scope}
              activeFloor={activeFloor}
              onJump={(floor) => {
                setActiveFloor(floor);
                scrollToFloor(floor);
              }}
            />
            <div className="min-w-0 flex-1">
            <GimmickFilterBar
              required={dungeon.data.requiredGimmicks}
              notable={dungeon.data.cautionGimmicks}
              glossary={glossary}
              selectedId={selectedId}
              scope={scope}
              onToggle={toggleGimmick}
              onScope={setScope}
              onOpenList={() => setSheetOpen(true)}
            />
            {sheetOpen && (
              <GimmickListSheet
                required={dungeon.data.requiredGimmicks}
                notable={dungeon.data.cautionGimmicks}
                glossary={glossary}
                selectedId={selectedId}
                onToggle={toggleGimmick}
                onClose={() => setSheetOpen(false)}
              />
            )}

            <h2 className="mb-3 text-[13px] font-bold tracking-wider text-slate-300 uppercase">
              Preemptive / floor reference
            </h2>
            <FloorCards
              floors={dungeon.data.floors}
              gimmicks={allGimmicks}
              glossary={glossary}
              selectedId={selectedId}
              scope={scope}
            />
            <div className="ds-card hidden overflow-x-auto md:block">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <thead className="bg-[var(--color-inset)]">
                  <tr>
                    <th className="ds-label border-b border-[var(--color-border)] px-3 py-2 w-[12%]">
                      Floor
                    </th>
                    <th className="ds-label border-b border-[var(--color-border)] px-3 py-2 w-[28%]">
                      Spawn
                    </th>
                    <th className="ds-label border-b border-[var(--color-border)] px-3 py-2">
                      Effects
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dungeon.data.floors.map((floor) => {
                    const spawnDims = floor.spawns.map(
                      (spawn) =>
                        selectedId != null &&
                        !spawnHasGimmick(spawn.effects, selectedId, scope),
                    );
                    const floorDim = floorIsDim(floor.spawns, selectedId, scope);
                    return floor.spawns.map((spawn, spawnIdx) => (
                      <tr
                        key={`${floor.floor}-${spawnIdx}`}
                        data-floor={spawnIdx === 0 ? floor.floor : undefined}
                        className={`scroll-mt-44 border-b border-[var(--color-border)] align-top transition-colors duration-150 last:border-b-0 hover:bg-[var(--color-hover)]/50`}
                      >
                        {spawnIdx === 0 && (
                          <td
                            rowSpan={floor.spawns.length}
                            className={`border-r border-b border-[var(--color-border)] bg-[var(--color-hover)]/60 px-3 py-3 text-center font-semibold text-[var(--color-fg-strong)] transition-opacity ${
                              floorDim ? "opacity-40" : ""
                            }`}
                          >
                            <div>
                              {glossary
                                ? translateLine(floor.floor, glossary)
                                : floor.floor}
                            </div>
                            {floor.spawnNote && (
                              <div className="mt-1 text-xs font-normal text-[var(--color-muted)]">
                                {glossary
                                  ? translateSpawnNote(floor.spawnNote, glossary)
                                  : floor.spawnNote}
                              </div>
                            )}
                          </td>
                        )}
                        <td
                          className={`px-3 py-3 transition-opacity ${
                            spawnDims[spawnIdx] ? "opacity-40" : ""
                          }`}
                        >
                          <SpawnCell spawn={spawn} glossary={glossary} />
                        </td>
                        <td
                          className={`px-3 py-3 transition-opacity ${
                            spawnDims[spawnIdx] ? "opacity-40" : ""
                          }`}
                        >
                          <EffectLines
                            spawn={spawn}
                            gimmicks={allGimmicks}
                            glossary={glossary}
                            selectedId={selectedId}
                            scope={scope}
                          />
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
