import { useEffect, useMemo, useState } from "react";
import { fetchMonstersByIds } from "../api";
import { parseChangeToMonsterIds } from "../lib/format-active-skill-desc";
import { monsterRowId } from "../lib/filters";
import type { MonsterRecord } from "../types";
import { MonsterCollabGroupPanel } from "./MonsterCollabGroupPanel";
import { MonsterDetailCard } from "./MonsterDetailCard";
import { MonsterEvoTreePanel } from "./MonsterEvoTreePanel";

type Overlay = "evo" | "collab" | null;

type Props = {
  row: MonsterRecord;
  onSelect: (row: MonsterRecord) => void;
  /** Mobile sidebar: fill container width, no centering gap. */
  sidebar?: boolean;
};

export function MonsterDetailPanel({ row, onSelect, sidebar = false }: Props) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [changeTargetLoadingId, setChangeTargetLoadingId] = useState<
    number | null
  >(null);
  const monsterId = monsterRowId(row);
  const changeTargetIds = useMemo(
    () => parseChangeToMonsterIds(row.active_skill_desc_en?.trim() ?? ""),
    [row.active_skill_desc_en]
  );

  useEffect(() => {
    setOverlay(null);
    setChangeTargetLoadingId(null);
  }, [monsterId]);

  const handleSelect = (next: MonsterRecord) => {
    setOverlay(null);
    onSelect(next);
  };

  const handleSelectChangeTarget = async (targetId: number) => {
    setChangeTargetLoadingId(targetId);
    try {
      const { rows } = await fetchMonstersByIds([targetId]);
      const next = rows[0];
      if (next) handleSelect(next);
    } finally {
      setChangeTargetLoadingId(null);
    }
  };

  return (
    <div
      className={`relative flex h-full w-full flex-col ${
        sidebar ? "min-h-0" : "mx-auto min-h-[min(100%,720px)] max-w-[360px]"
      }`}
    >
      <MonsterDetailCard
        row={row}
        evoActive={overlay === "evo"}
        collabActive={overlay === "collab"}
        onOpenEvo={() => setOverlay((v) => (v === "evo" ? null : "evo"))}
        onOpenCollab={() =>
          setOverlay((v) => (v === "collab" ? null : "collab"))
        }
        changeTargetIds={changeTargetIds}
        onSelectChangeTarget={handleSelectChangeTarget}
        changeTargetLoadingId={changeTargetLoadingId}
        compact={sidebar}
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
