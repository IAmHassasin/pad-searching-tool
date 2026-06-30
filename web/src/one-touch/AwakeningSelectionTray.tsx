import { AwakeningSpriteIcon } from "../components/AwakeningSpriteIcon";
import { buildOneTouchMonsterSearchUrl } from "../lib/monster-search-url";
import type { AwakeningSelectionEntry } from "./types";

type Props = {
  entries: AwakeningSelectionEntry[];
  onSetCount: (id: number, count: number) => void;
  onRemove: (id: number) => void;
  onClear: () => void;
};

export function AwakeningSelectionTray({
  entries,
  onSetCount,
  onRemove,
  onClear,
}: Props) {
  if (!entries.length) return null;

  const searchUrl = buildOneTouchMonsterSearchUrl(
    entries.map((e) => ({ id: e.id, count: e.count }))
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[#0d1117]/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-[var(--color-muted)]">
          Search queue (match all)
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-1.5 py-1"
            >
              <AwakeningSpriteIcon
                awokenSkillId={e.id}
                size={22}
                label={e.nameEn}
              />
              <span className="max-w-[8rem] truncate text-xs">{e.nameEn}</span>
              <div className="flex items-center rounded border border-[var(--color-border)]">
                <button
                  type="button"
                  className="px-1.5 text-xs hover:bg-[#21262d]"
                  aria-label="Decrease stack"
                  onClick={() =>
                    e.count <= 1
                      ? onRemove(e.id)
                      : onSetCount(e.id, e.count - 1)
                  }
                >
                  −
                </button>
                <span className="min-w-[1.25rem] text-center text-xs tabular-nums">
                  ×{e.count}
                </span>
                <button
                  type="button"
                  className="px-1.5 text-xs hover:bg-[#21262d]"
                  aria-label="Increase stack"
                  onClick={() => onSetCount(e.id, Math.min(8, e.count + 1))}
                  disabled={e.count >= 8}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="text-xs text-[var(--color-muted)] hover:text-[#f85149]"
                aria-label={`Remove ${e.nameEn}`}
                onClick={() => onRemove(e.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[#21262d]"
            onClick={onClear}
          >
            Clear
          </button>
          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[#0d1117] hover:opacity-90"
          >
            Open in monster search
          </a>
        </div>
      </div>
    </div>
  );
}
