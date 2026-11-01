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
    <div className="glass-bar animate-sheet-in fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-white/10 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-8px_24px_rgba(0,0,0,0.45)] sm:px-4">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 sm:gap-3">
        <span className="ds-label w-full sm:w-auto">
          Search queue (match all)
        </span>
        <div className="flex max-h-28 min-w-0 flex-1 flex-wrap items-center gap-1.5 overflow-y-auto sm:max-h-none sm:gap-2 sm:overflow-visible">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-1 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)] py-0.5 pr-1 pl-1"
            >
              <AwakeningSpriteIcon
                awokenSkillId={e.id}
                size={22}
                label={e.nameEn}
              />
              <span className="max-w-[8rem] truncate text-xs text-[var(--color-fg)]">
                {e.nameEn}
              </span>
              <div className="flex items-center overflow-hidden rounded-md border border-[var(--color-border-strong)] bg-[var(--color-inset)]">
                <button
                  type="button"
                  className="pressable min-h-7 px-2 text-xs text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg-strong)]"
                  aria-label="Decrease stack"
                  onClick={() =>
                    e.count <= 1
                      ? onRemove(e.id)
                      : onSetCount(e.id, e.count - 1)
                  }
                >
                  −
                </button>
                <span className="min-w-[1.5rem] text-center font-mono text-xs font-semibold text-[var(--color-accent-strong)] tabular-nums">
                  ×{e.count}
                </span>
                <button
                  type="button"
                  className="pressable min-h-7 px-2 text-xs text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg-strong)] disabled:opacity-40"
                  aria-label="Increase stack"
                  onClick={() => onSetCount(e.id, Math.min(8, e.count + 1))}
                  disabled={e.count >= 8}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="pressable flex h-7 w-6 items-center justify-center text-sm text-[var(--color-muted)] hover:text-[var(--color-negative)]"
                aria-label={`Remove ${e.nameEn}`}
                onClick={() => onRemove(e.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <button
            type="button"
            className="ds-btn pressable min-h-11 px-3 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-negative)] sm:min-h-9"
            onClick={onClear}
          >
            Clear
          </button>
          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ds-btn-primary pressable flex min-h-11 flex-1 items-center justify-center px-4 text-sm sm:min-h-9 sm:flex-none sm:text-xs"
          >
            Open in monster search
          </a>
        </div>
      </div>
    </div>
  );
}
