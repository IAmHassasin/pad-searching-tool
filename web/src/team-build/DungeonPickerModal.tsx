import { useMemo, useState } from "react";
import type { DungeonSummary } from "../dungeon-details/types";
import {
  CUSTOM_DUNGEON_ID,
  dungeonCategories,
  filterDungeonEntries,
  NO_DUNGEON_ID,
  type DungeonCatalogEntry,
} from "../lib/team-build/dungeon-catalog";
import { describeDungeonModifiers } from "../lib/team-build/dungeon-modifiers";
import { maxHitForEntry } from "../lib/team-build/dungeon-sources";
import type {
  CustomDungeonModifiers,
  TeamBuildConfig,
} from "../lib/team-build/types";

type Props = {
  open: boolean;
  config: TeamBuildConfig;
  /** Catalog merged with the imported floor tables (useDungeonEntries). */
  entries: DungeonCatalogEntry[];
  seedsByPostId: Map<number, DungeonSummary>;
  onChange: (next: TeamBuildConfig) => void;
  onClose: () => void;
  /** Opens the manual awakening modifier modal (kept as an advanced path). */
  onOpenAdvanced: () => void;
};

const NUM_INPUT =
  "ds-input min-h-8 w-16 px-1.5 py-0.5 text-center font-mono text-xs tabular-nums";

function Chip({ text }: { text: string }) {
  const tone =
    text === "Sun"
      ? "border-[var(--color-pad-light)]/50 text-[var(--color-pad-light)]"
      : text === "Moon"
        ? "border-[var(--color-pad-dark)]/50 text-[var(--color-pad-dark)]"
        : text.startsWith("Multiplayer")
          ? "border-[var(--color-secondary)]/50 text-[var(--color-secondary-strong)]"
          : text.startsWith("Max hit")
            ? "border-[var(--color-negative)]/50 text-red-300"
          : /×0(\.|$)/.test(text)
            ? "border-[var(--color-negative)]/50 text-red-300"
            : "border-[var(--color-positive)]/50 text-emerald-300";
  return (
    <span
      className={`rounded-full border bg-[var(--color-inset)] px-1.5 py-px font-mono text-[9px] font-semibold ${tone}`}
    >
      {text}
    </span>
  );
}

function OptionRow({
  selected,
  title,
  subtitle,
  chips,
  onSelect,
  sourceUrl,
}: {
  selected: boolean;
  title: string;
  subtitle?: string;
  chips: string[];
  onSelect: () => void;
  sourceUrl?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
        selected
          ? "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)] shadow-[var(--shadow-glow)]"
          : "border-white/[0.06] bg-[var(--color-panel)]/90 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)]"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="pressable flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
      >
        <span className="w-full truncate text-xs font-semibold text-[var(--color-fg-strong)]">
          {title}
        </span>
        {subtitle && (
          <span className="w-full truncate text-[10px] text-[var(--color-muted)]">
            {subtitle}
          </span>
        )}
        {chips.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {chips.map((c) => (
              <Chip key={c} text={c} />
            ))}
          </span>
        )}
      </button>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          title="Source"
          aria-label={`Source for ${title}`}
          className="pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[11px] text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-accent-strong)]"
        >
          ↗
        </a>
      )}
    </div>
  );
}

/**
 * Multiplier field that keeps the raw text while typing ("0." / "") and only
 * commits finite values, so clearing the box never collapses totals to ×0.
 */
function MultiplierField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (next: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const shown = editing ? text : String(value);
  return (
    <label className="flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
      <span className="w-7 font-semibold uppercase">{label}</span>
      <span>×</span>
      <input
        type="number"
        step={0.05}
        min={0}
        max={100}
        value={shown}
        onFocus={() => {
          setText(String(value));
          setEditing(true);
        }}
        onBlur={() => setEditing(false)}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          if (raw.trim() === "") return;
          const n = Number(raw);
          if (Number.isFinite(n) && n >= 0) onCommit(n);
        }}
        className={NUM_INPUT}
      />
    </label>
  );
}

function CustomEditor({
  value,
  onChange,
}: {
  value: CustomDungeonModifiers;
  onChange: (next: CustomDungeonModifiers) => void;
}) {
  const numField = (key: "hp" | "atk" | "rcv") => (
    <MultiplierField
      key={key}
      label={key}
      value={value[key]}
      onCommit={(n) => onChange({ ...value, [key]: n })}
    />
  );
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-[var(--color-inset)]/60 px-2 py-1.5">
      {numField("hp")}
      {numField("atk")}
      {numField("rcv")}
      <label className="flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
        <input
          type="checkbox"
          checked={value.sun}
          onChange={(e) =>
            onChange({ ...value, sun: e.target.checked, moon: e.target.checked ? false : value.moon })
          }
          className="accent-[var(--color-accent)]"
        />
        Sun
      </label>
      <label className="flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
        <input
          type="checkbox"
          checked={value.moon}
          onChange={(e) =>
            onChange({ ...value, moon: e.target.checked, sun: e.target.checked ? false : value.sun })
          }
          className="accent-[var(--color-accent)]"
        />
        Moon
      </label>
    </div>
  );
}

/**
 * Dungeon list that replaces the "Dungeon awk" button: picking an entry sets
 * its team-wide stat multipliers and the awakenings it activates.
 */
export function DungeonPickerModal({
  open,
  config,
  entries: allEntries,
  seedsByPostId,
  onChange,
  onClose,
  onOpenAdvanced,
}: Props) {
  const [query, setQuery] = useState("");
  const entries = useMemo(
    () => filterDungeonEntries(allEntries, query),
    [allEntries, query]
  );
  const categories = useMemo(() => dungeonCategories(entries), [entries]);
  // Hardest hit from the linked floor table, shown next to the stat chips.
  const chipsFor = (d: DungeonCatalogEntry): string[] => {
    const chips = describeDungeonModifiers(d.stat, d);
    const max = maxHitForEntry(d, seedsByPostId);
    return max ? [...chips, `Max hit ${max.value.toLocaleString("en-US")}`] : chips;
  };
  if (!open) return null;

  const select = (id: string) => onChange({ ...config, dungeonId: id });
  const current = config.dungeonId || NO_DUNGEON_ID;
  const manualCount = config.awkSettings.enabled.length;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-3"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Choose dungeon"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="ds-float animate-sheet-in flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-3xl pb-[env(safe-area-inset-bottom)] sm:animate-none sm:rounded-2xl sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-2">
          <h2 className="text-sm font-bold text-[var(--color-fg-strong)]">Dungeon</h2>
          <span className="rounded-full border border-[var(--color-secondary)]/40 bg-[var(--color-secondary-muted)] px-1.5 py-px font-mono text-[9px] font-bold tabular-nums text-[var(--color-secondary-strong)]">
            {allEntries.length} listed
          </span>
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="pressable flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-sm leading-none text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-fg-strong)]"
            >
              ×
            </button>
          </div>
        </header>

        <div className="shrink-0 px-3 pt-2">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dungeon (EN / JP) or category…"
            aria-label="Search dungeons"
            className="ds-input min-h-9 w-full px-2.5 py-1.5 text-xs"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
          {!query.trim() && (
            <>
              <OptionRow
                selected={current === NO_DUNGEON_ID}
                title="No dungeon"
                subtitle="Totals use badge + leader skills only"
                chips={[]}
                onSelect={() => select(NO_DUNGEON_ID)}
              />
              <div>
                <OptionRow
                  selected={current === CUSTOM_DUNGEON_ID}
                  title="Custom"
                  subtitle="Enter the multipliers yourself"
                  chips={describeDungeonModifiers(config.customDungeon, config.customDungeon)}
                  onSelect={() => select(CUSTOM_DUNGEON_ID)}
                />
                {current === CUSTOM_DUNGEON_ID && (
                  <CustomEditor
                    value={config.customDungeon}
                    onChange={(customDungeon) =>
                      onChange({ ...config, customDungeon })
                    }
                  />
                )}
              </div>
            </>
          )}

          {categories.map((category) => (
            <section key={category}>
              <p className="ds-label mb-1 px-0.5 text-[var(--color-accent-strong)]">
                {category}
              </p>
              <div className="space-y-1">
                {entries
                  .filter((d) => d.category === category)
                  .map((d: DungeonCatalogEntry) => (
                    <OptionRow
                      key={d.id}
                      selected={current === d.id}
                      title={d.nameEn}
                      subtitle={d.nameJa + (d.notes ? ` · ${d.notes}` : "")}
                      chips={chipsFor(d)}
                      onSelect={() => select(d.id)}
                      sourceUrl={d.sourceUrl}
                    />
                  ))}
              </div>
            </section>
          ))}

          {entries.length === 0 && (
            <p className="px-1 py-3 text-center text-xs text-[var(--color-muted)]">
              No dungeon matches “{query.trim()}”.
            </p>
          )}
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] px-3 py-2">
          <button
            type="button"
            onClick={onOpenAdvanced}
            className="ds-btn pressable min-h-8 px-3 text-[11px] font-semibold"
          >
            Advanced awakenings{manualCount > 0 ? ` (${manualCount})` : ""}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="ds-btn-primary pressable min-h-9 px-4 text-xs"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
