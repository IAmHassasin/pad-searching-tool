import { useQuery } from "@tanstack/react-query";
import { fetchCollabGroup } from "../api";
import { monsterRowId } from "../lib/filters";
import type { MonsterRecord } from "../types";
import { StarRow } from "./monster-card-shared";
import { MonsterRelationIcon } from "./MonsterRelationIcon";

type Props = {
  monsterId: number;
  onClose: () => void;
  onSelect: (row: MonsterRecord) => void;
};

export function MonsterCollabGroupPanel({
  monsterId,
  onClose,
  onSelect,
}: Props) {
  const query = useQuery({
    queryKey: ["monsters", "collab-group", monsterId],
    queryFn: () => fetchCollabGroup(monsterId),
    staleTime: 60_000,
  });

  const totalMonsters =
    query.data?.byRarity.reduce((sum, g) => sum + g.monsters.length, 0) ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border-2 border-[#a8842f] bg-[#0f0c0a]/98 shadow-[0_8px_32px_rgba(0,0,0,0.65)]">
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-[#6b4f2a]/80 bg-[#2f2118]/95 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-[#c9b08a]">Group</p>
          <h3 className="truncate text-xs font-bold text-white">
            {query.data?.groupName ??
              (query.data?.groupId
                ? `Group #${query.data.groupId}`
                : "No group")}
          </h3>
          {query.data && query.data.groupId > 0 && (
            <p className="text-[10px] text-[#9ec5ff]">
              Group #{query.data.groupId} · {totalMonsters} monster
              {totalMonsters === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded border border-[#6b4f2a]/80 px-2 py-0.5 text-[10px] text-[#c9b08a] hover:border-[#c9a84a] hover:text-white"
        >
          Close
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {query.isLoading && (
          <p className="text-xs text-[#c9b08a]">Loading collab group…</p>
        )}
        {query.error && (
          <p className="text-xs text-red-300">
            {query.error instanceof Error
              ? query.error.message
              : "Failed to load collab group."}
          </p>
        )}
        {query.data && query.data.groupId === 0 && (
          <p className="text-xs text-[#c9b08a]">
            This monster is not part of a collab group.
          </p>
        )}
        {query.data?.byRarity.map(({ rarity, monsters }) => (
          <section key={rarity} className="mb-4 last:mb-0">
            <div className="mb-2 flex items-center gap-2">
              <StarRow count={rarity} />
              <span className="text-[10px] font-semibold text-[#c9b08a]">
                {rarity}★
              </span>
              <span className="text-[10px] text-[#8b9a6b]">
                ({monsters.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {monsters.map((row) => (
                <MonsterRelationIcon
                  key={monsterRowId(row)}
                  row={row}
                  selected={monsterRowId(row) === monsterId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
