import { useMemo, useState } from "react";
import { AwakeningSpriteIcon } from "../components/AwakeningSpriteIcon";
import { buildOneTouchMonsterSearchUrl } from "../lib/monster-search-url";
import type { OneTouchAwakeningEffect } from "./types";

type Props = {
  effects: OneTouchAwakeningEffect[];
  onAddAwakening: (id: number, nameEn: string) => void;
  className?: string;
};

export function AwakeningLookupPanel({
  effects,
  onAddAwakening,
  className = "",
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return effects;
    return effects.filter(
      (e) =>
        e.nameEn.toLowerCase().includes(q) ||
        e.nameJa.includes(query.trim()) ||
        e.effectEn.toLowerCase().includes(q) ||
        e.effectJa.includes(query.trim())
    );
  }, [effects, query]);

  return (
    <aside
      className={`flex min-h-0 flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] ${className}`}
    >
      <div className="shrink-0 border-b border-[var(--color-border)] px-3 py-2">
        <h2 className="text-sm font-semibold">Awakening lookup</h2>
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">
          One-Touch effects. Click to queue search (excludes Dungeon Bonus).
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or effect…"
          className="mt-2 w-full rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 columns-2 gap-x-3 xl:columns-3 2xl:columns-4">
        {filtered.map((e) => (
          <div
            key={`${e.id ?? e.nameJa}-${e.nameEn}`}
            className="mb-1.5 break-inside-avoid"
          >
            <AwakeningEffectRow effect={e} onAdd={onAddAwakening} />
          </div>
        ))}
        {!filtered.length && (
          <p className="col-span-full px-2 py-4 text-center text-sm text-[var(--color-muted)]">
            No matches
          </p>
        )}
      </div>
    </aside>
  );
}

function AwakeningEffectRow({
  effect,
  onAdd,
}: {
  effect: OneTouchAwakeningEffect;
  onAdd: (id: number, nameEn: string) => void;
}) {
  const canSearch = effect.id != null;

  return (
    <div className="flex gap-1.5 rounded-md px-0.5 py-1 hover:bg-[#21262d]">
      {canSearch ? (
        <button
          type="button"
          className="shrink-0"
          title={`Add ${effect.nameEn} to search queue`}
          onClick={() => onAdd(effect.id!, effect.nameEn)}
        >
          <AwakeningSpriteIcon
            awokenSkillId={effect.id!}
            size={22}
            label={effect.nameEn}
          />
        </button>
      ) : (
        <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-sm border border-[var(--color-border)] text-[9px] text-[var(--color-muted)]">
          ?
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
          <span className="text-xs font-medium leading-tight">
            {effect.nameEn}
          </span>
          {canSearch && (
            <a
              href={buildOneTouchMonsterSearchUrl([
                { id: effect.id!, count: 1 },
              ])}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-[var(--color-accent)] hover:underline"
              onClick={(ev) => ev.stopPropagation()}
            >
              Search
            </a>
          )}
        </div>
        <p
          className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--color-muted)]"
          title={effect.effectJa}
        >
          {effect.effectEn}
        </p>
      </div>
    </div>
  );
}
