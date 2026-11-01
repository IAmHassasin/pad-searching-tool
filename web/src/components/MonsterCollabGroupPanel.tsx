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
    <div className="ds-card flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <div className="min-w-0">
          <p className="ds-label">Group</p>
          <h3 className="truncate text-xs font-bold text-[var(--color-fg-strong)]">
            {query.data?.groupName ??
              (query.data?.groupId
                ? `Group #${query.data.groupId}`
                : "No group")}
          </h3>
          {query.data && query.data.groupId > 0 && (
            <p className="text-[10px] text-[var(--color-muted)]">
              Group{" "}
              <span className="font-mono font-bold tabular-nums text-[var(--color-accent-strong)]">
                #{query.data.groupId}
              </span>{" "}
              · <span className="font-mono tabular-nums">{totalMonsters}</span> monster
              {totalMonsters === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ds-btn pressable min-h-8 shrink-0 px-2.5 py-1 text-[11px] font-semibold"
        >
          Close
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {query.isLoading && (
          <p className="text-xs text-[var(--color-muted)]">Loading collab group…</p>
        )}
        {query.error && (
          <p className="text-xs text-red-300">
            {query.error instanceof Error
              ? query.error.message
              : "Failed to load collab group."}
          </p>
        )}
        {query.data && query.data.groupId === 0 && (
          <p className="text-xs text-[var(--color-muted)]">
            This monster is not part of a collab group.
          </p>
        )}
        {query.data?.byRarity.map(({ rarity, monsters }) => (
          <section key={rarity} className="mb-4 last:mb-0">
            <div className="mb-2 flex items-center gap-2">
              <StarRow count={rarity} />
              <span className="font-mono text-[10px] font-semibold tabular-nums text-[var(--color-muted)]">
                {rarity}★
              </span>
              <span className="font-mono text-[10px] tabular-nums text-[var(--color-faint)]">
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
