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
};

export function MonsterDetailPanel({ row, onSelect }: Props) {
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
    <div className="relative mx-auto flex h-full min-h-[min(100%,720px)] w-full max-w-[360px] flex-col">
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
