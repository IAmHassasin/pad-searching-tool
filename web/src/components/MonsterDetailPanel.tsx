import { useEffect, useState } from "react";
import { monsterRowId } from "../lib/filters";
import type { MonsterRecord } from "../types";
import { MonsterCollabGroupPanel } from "./MonsterCollabGroupPanel";
import { MonsterDetailCard } from "./MonsterDetailCard";
import { MonsterEvoTreePanel } from "./MonsterEvoTreePanel";

type Overlay = "evo" | "collab" | null;

type Props = {
  row: MonsterRecord;
  onSelect: (row: MonsterRecord) => void;
};

export function MonsterDetailPanel({ row, onSelect }: Props) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const monsterId = monsterRowId(row);

  useEffect(() => {
    setOverlay(null);
  }, [monsterId]);

  const handleSelect = (next: MonsterRecord) => {
    setOverlay(null);
    onSelect(next);
  };

  return (
    <div className="relative mx-auto flex h-full min-h-[min(100%,720px)] w-full max-w-[360px] flex-col">
      <MonsterDetailCard
        row={row}
        evoActive={overlay === "evo"}
        collabActive={overlay === "collab"}
        onOpenEvo={() => setOverlay((v) => (v === "evo" ? null : "evo"))}
        onOpenCollab={() =>
          setOverlay((v) => (v === "collab" ? null : "collab"))
        }
      />

      {overlay && (
        <div className="absolute inset-0 z-30 flex min-h-0 flex-col p-0">
          {overlay === "evo" ? (
            <MonsterEvoTreePanel
              monsterId={monsterId}
              onClose={() => setOverlay(null)}
              onSelect={handleSelect}
            />
          ) : (
            <MonsterCollabGroupPanel
              monsterId={monsterId}
              onClose={() => setOverlay(null)}
              onSelect={handleSelect}
            />
          )}
        </div>
      )}
    </div>
  );
}
