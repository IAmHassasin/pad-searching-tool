import { useCallback, useMemo, useState } from "react";
import { ONE_TOUCH_DUNGEONS, ONE_TOUCH_AWAKENING_EFFECTS } from "./catalog";
import { AwakeningLookupPanel } from "./AwakeningLookupPanel";
import { AwakeningSelectionTray } from "./AwakeningSelectionTray";
import { DungeonAttributePicker } from "./DungeonAttributePicker";
import { DungeonFloorPanel } from "./DungeonFloorPanel";
import { useAwakeningSelection } from "./useAwakeningSelection";
import type { OneTouchFloor } from "./types";

const DEFAULT_DUNGEON_ID = ONE_TOUCH_DUNGEONS[0]?.id ?? "volcano";

function readDungeonFromHash(): string | null {
  const m = window.location.hash.match(/^#([a-z]+)$/);
  return m ? m[1] : null;
}

export function OneTouchPage() {
  const [dungeonId, setDungeonId] = useState(
    () => readDungeonFromHash() ?? DEFAULT_DUNGEON_ID
  );
  const [showHiddenGlobal, setShowHiddenGlobal] = useState(false);
  const [expandedHiddenLevels, setExpandedHiddenLevels] = useState<Set<number>>(
    () => new Set()
  );

  const selection = useAwakeningSelection();

  const dungeon = useMemo(
    () => ONE_TOUCH_DUNGEONS.find((d) => d.id === dungeonId) ?? ONE_TOUCH_DUNGEONS[0],
    [dungeonId]
  );

  const selectDungeon = useCallback((id: string) => {
    setDungeonId(id);
    window.history.replaceState(null, "", `#${id}`);
  }, []);

  const toggleHiddenLevel = useCallback((level: number) => {
    setExpandedHiddenLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }, []);

  const onToggleHiddenGlobal = useCallback(() => {
    setShowHiddenGlobal((v) => !v);
  }, []);

  const onAddFloorAwakenings = useCallback(
    (floor: OneTouchFloor) => {
      selection.addFloorAwakenings(floor.recommendedAwakenings);
    },
    [selection]
  );

  if (!dungeon) {
    return (
      <div className="p-6 text-[var(--color-muted)]">No dungeon data loaded.</div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[var(--color-surface)] text-[#e6edf3]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold">One-Touch Dungeon</h1>
              <p className="text-sm text-[var(--color-muted)]">
                Floor guides &amp; awakening reference (English)
              </p>
            </div>
            <a
              href="/"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              ← Monster search
            </a>
          </div>
          <div className="mt-4">
            <DungeonAttributePicker
              dungeons={ONE_TOUCH_DUNGEONS}
              selectedId={dungeon.id}
              onSelect={selectDungeon}
            />
          </div>
        </div>
      </header>

      <main
        className={`mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-4 lg:grid-cols-2 lg:items-stretch ${
          selection.entries.length ? "pb-24" : ""
        }`}
      >
        <AwakeningLookupPanel
          effects={ONE_TOUCH_AWAKENING_EFFECTS}
          onAddAwakening={selection.add}
          className="lg:max-h-[calc(100vh-12.5rem)]"
        />
        <DungeonFloorPanel
          dungeonName={dungeon.nameEn}
          floors={dungeon.floors}
          showHiddenGlobal={showHiddenGlobal}
          onToggleHiddenGlobal={onToggleHiddenGlobal}
          expandedHiddenLevels={expandedHiddenLevels}
          onToggleHiddenLevel={toggleHiddenLevel}
          onAddAwakening={selection.add}
          onAddFloorAwakenings={onAddFloorAwakenings}
          className="lg:max-h-[calc(100vh-12.5rem)]"
        />
      </main>

      <AwakeningSelectionTray
        entries={selection.entries}
        onSetCount={selection.setCount}
        onRemove={selection.remove}
        onClear={selection.clear}
      />
    </div>
  );
}
