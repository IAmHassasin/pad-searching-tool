import { useQuery } from "@tanstack/react-query";
import { MonsterPortrait } from "../components/MonsterPortrait";
import { fetchDungeon, type EnglishGlossary } from "./api";
import type { DungeonSpawn, GimmickChip } from "./types";
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

function GimmickSection({
  title,
  chips,
  glossary,
}: {
  title: string;
  chips: GimmickChip[];
  glossary: EnglishGlossary | undefined;
}) {
  if (!chips.length) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-[var(--color-muted)]">
        {title}
      </h2>
      <div className="flex flex-wrap gap-2">
        {chips.map((g) => {
          const label = glossary
            ? translateGimmick(g.id, g.labelJa, glossary)
            : g.labelJa;
          return (
          <span
            key={g.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-1 text-xs"
            title={label}
          >
            <img
              src={g.iconUrl}
              alt=""
              className="h-5 w-5 object-contain"
              loading="lazy"
            />
            {label}
          </span>
        );
        })}
      </div>
    </section>
  );
}

function SpawnCell({
  spawn,
  glossary,
}: {
  spawn: DungeonSpawn;
  glossary: EnglishGlossary | undefined;
}) {
  const displayName =
    spawn.nameEn?.trim() ||
    (spawn.monsterId != null ? `#${spawn.monsterId}` : "Unknown monster");

  const hp = spawn.hp ? formatPadStatM(spawn.hp) : null;
  const def = spawn.defense ? formatPadStatM(spawn.defense) : null;

  return (
    <div className="space-y-1 text-sm">
      {spawn.monsterId != null && (
        <MonsterPortrait
          monsterId={spawn.monsterId}
          variant="icon"
          alt={displayName}
          className="mx-auto h-12 w-12 object-contain"
        />
      )}
      <div className="font-medium" title={displayName}>
        {displayName}
      </div>
      {spawn.monsterId != null && (
        <div className="text-xs text-[var(--color-muted)]">#{spawn.monsterId}</div>
      )}
      {spawn.types.length > 0 && (
        <div className="text-xs text-[var(--color-muted)]">
          {spawn.types
            .map((t) => (glossary ? translateType(t, glossary) : t))
            .join(" · ")}
        </div>
      )}
      {(hp || def) && (
        <div className="text-xs">
          {hp && <div>HP: {hp}</div>}
          {def && <div>DEF: {def}</div>}
        </div>
      )}
      {spawn.parts?.map((p) => {
        const partHp = p.hp ? formatPadStatM(p.hp) : null;
        const partDef = p.defense ? formatPadStatM(p.defense) : null;
        return (
        <div key={p.label} className="text-xs text-[var(--color-muted)]">
          [{glossary ? translatePartLabel(p.label, glossary) : p.label}]{" "}
          {partHp && `HP: ${partHp}`} {partDef && `DEF: ${partDef}`}
        </div>
      );
      })}
    </div>
  );
}

function EffectLines({
  spawn,
  gimmicks,
  glossary,
}: {
  spawn: DungeonSpawn;
  gimmicks: Map<string, GimmickChip>;
  glossary: EnglishGlossary | undefined;
}) {
  return (
    <ul className="space-y-1.5 text-sm leading-relaxed">
      {spawn.effects.map((effect, i) => {
        const en = glossary ? translateLine(effect.raw, glossary) : effect.raw;
        return (
          <li key={i}>
            <div>{en}</div>
            {(effect.tags.length > 0 || effect.gimmickIds.length > 0) && (
              <div className="mt-0.5 flex flex-wrap gap-1">
                {effect.tags.map((tag) => {
                  const tagEn = glossary ? translateTag(tag, glossary) : tag;
                  return (
                  <span
                    key={tag}
                    className="rounded bg-blue-950/60 px-1.5 py-0.5 text-[10px] text-blue-200"
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
                      className="inline-flex items-center gap-1.5 rounded bg-amber-950/50 px-2 py-1 text-xs text-amber-100"
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

export function DungeonDetailsPage({ postId }: { postId: string }) {
  const dungeon = useQuery({
    queryKey: ["dungeon-details", postId],
    queryFn: () => fetchDungeon(postId),
  });
  const glossaryQuery = useEnglishGlossary();
  const glossary = glossaryQuery.data;
  const translationsReady = glossaryQuery.isSuccess && glossary != null;

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
    <div className="min-h-full bg-[var(--color-surface)] text-[#e6edf3]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href="/dungeon-details"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              ← All dungeons
            </a>
            <a href="/" className="text-sm text-[var(--color-muted)] hover:underline">
              Monster search
            </a>
          </div>
          {dungeon.data && (
            <>
              <h1 className="mt-2 text-lg font-semibold leading-snug">
                {title}
              </h1>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                <a
                  href={dungeon.data.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-accent)] hover:underline"
                >
                  AppMedia source
                </a>
                {" · "}
                imported {dungeon.data.importedAt.slice(0, 10)}
              </p>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {dungeon.isLoading && (
          <p className="text-[var(--color-muted)]">Loading…</p>
        )}
        {dungeon.data && glossaryQuery.isLoading && (
          <p className="text-[var(--color-muted)]">Loading translations…</p>
        )}
        {dungeon.data && glossaryQuery.isError && (
          <p className="text-red-400">Failed to load English translations.</p>
        )}
        {dungeon.isError && (
          <p className="text-red-400">
            {dungeon.error instanceof Error
              ? dungeon.error.message
              : "Failed to load"}
          </p>
        )}

        {dungeon.data && translationsReady && (
          <>
            <GimmickSection
              title="Required mechanics"
              chips={dungeon.data.requiredGimmicks}
              glossary={glossary}
            />
            <GimmickSection
              title="Notable mechanics"
              chips={dungeon.data.cautionGimmicks}
              glossary={glossary}
            />

            <h2 className="mb-3 text-base font-semibold">Preemptive / floor reference</h2>
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-[var(--color-panel)] text-xs text-[var(--color-muted)]">
                  <tr>
                    <th className="border-b border-[var(--color-border)] px-3 py-2 w-[12%]">
                      Floor
                    </th>
                    <th className="border-b border-[var(--color-border)] px-3 py-2 w-[28%]">
                      Spawn
                    </th>
                    <th className="border-b border-[var(--color-border)] px-3 py-2">
                      Effects
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dungeon.data.floors.map((floor) =>
                    floor.spawns.map((spawn, spawnIdx) => (
                      <tr
                        key={`${floor.floor}-${spawnIdx}`}
                        className="border-b border-[var(--color-border)]/70 align-top"
                      >
                        {spawnIdx === 0 && (
                          <td
                            rowSpan={floor.spawns.length}
                            className="bg-[#1c2128] px-3 py-3 text-center font-semibold"
                          >
                            <div>{floor.floor}</div>
                            {floor.spawnNote && (
                              <div className="mt-1 text-xs font-normal text-[var(--color-muted)]">
                                {glossary
                                  ? translateSpawnNote(floor.spawnNote, glossary)
                                  : floor.spawnNote}
                              </div>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-3">
                          <SpawnCell spawn={spawn} glossary={glossary} />
                        </td>
                        <td className="px-3 py-3">
                          <EffectLines
                            spawn={spawn}
                            gimmicks={allGimmicks}
                            glossary={glossary}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
