import { useQuery } from "@tanstack/react-query";
import { fetchEvoTree } from "../api";
import { monsterRowId } from "../lib/filters";
import type { EvoTreeEdge, MonsterRecord } from "../types";
import { MonsterRelationIcon } from "./MonsterRelationIcon";

type TreeNode = {
  row: MonsterRecord;
  children: TreeNode[];
};

function buildEvoTree(
  nodes: MonsterRecord[],
  edges: EvoTreeEdge[],
  baseId: number
): TreeNode[] {
  const byId = new Map(nodes.map((row) => [monsterRowId(row), row] as const));
  const childIds = new Set(edges.map((e) => e.to));
  const childrenOf = new Map<number, number[]>();

  for (const edge of edges) {
    const list = childrenOf.get(edge.from) ?? [];
    list.push(edge.to);
    childrenOf.set(edge.from, list);
  }

  const toTree = (id: number, seen: Set<number>): TreeNode | null => {
    if (seen.has(id)) return null;
    const row = byId.get(id);
    if (!row) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(id);
    const childIdsForNode = childrenOf.get(id) ?? [];
    const children = childIdsForNode
      .map((childId) => toTree(childId, nextSeen))
      .filter((n): n is TreeNode => n != null);
    return { row, children };
  };

  const roots: number[] = [];
  if (byId.has(baseId)) {
    roots.push(baseId);
  } else {
    for (const id of byId.keys()) {
      if (!childIds.has(id)) roots.push(id);
    }
  }

  if (!roots.length) {
    return [...byId.values()].map((row) => ({ row, children: [] }));
  }

  const trees = roots
    .map((id) => toTree(id, new Set()))
    .filter((n): n is TreeNode => n != null);

  const placed = new Set<number>();
  const collect = (node: TreeNode) => {
    placed.add(monsterRowId(node.row));
    node.children.forEach(collect);
  };
  trees.forEach(collect);

  for (const [id, row] of byId) {
    if (!placed.has(id)) {
      trees.push({ row, children: [] });
    }
  }

  return trees;
}

function EvoTreeBranch({
  node,
  currentId,
  onSelect,
}: {
  node: TreeNode;
  currentId: number;
  onSelect: (row: MonsterRecord) => void;
}) {
  const id = monsterRowId(node.row);

  return (
    <div className="flex min-w-0 items-center gap-1">
      <MonsterRelationIcon
        row={node.row}
        selected={id === currentId}
        onSelect={onSelect}
      />
      {node.children.length > 0 && (
        <div className="flex min-w-0 flex-col gap-2 pl-1">
          {node.children.map((child) => (
            <div key={monsterRowId(child.row)} className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--color-faint)]" aria-hidden>
                →
              </span>
              <EvoTreeBranch
                node={child}
                currentId={currentId}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Props = {
  monsterId: number;
  onClose: () => void;
  onSelect: (row: MonsterRecord) => void;
};

export function MonsterEvoTreePanel({ monsterId, onClose, onSelect }: Props) {
  const query = useQuery({
    queryKey: ["monsters", "evo-tree", monsterId],
    queryFn: () => fetchEvoTree(monsterId),
    staleTime: 60_000,
  });

  const trees =
    query.data != null
      ? buildEvoTree(query.data.nodes, query.data.edges, query.data.baseId)
      : [];

  return (
    <div className="ds-card flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <div className="min-w-0">
          <p className="ds-label">Evolution</p>
          {query.data && (
            <p className="truncate text-xs text-[var(--color-fg)]">
              Base{" "}
              <span className="font-mono font-bold tabular-nums text-[var(--color-accent-strong)]">
                #{query.data.baseId}
              </span>{" "}
              · <span className="font-mono tabular-nums">{query.data.nodes.length}</span> form
              {query.data.nodes.length === 1 ? "" : "s"}
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
          <p className="text-xs text-[var(--color-muted)]">Loading evo tree…</p>
        )}
        {query.error && (
          <p className="text-xs text-red-300">
            {query.error instanceof Error
              ? query.error.message
              : "Failed to load evo tree."}
          </p>
        )}
        {query.data && query.data.nodes.length === 0 && (
          <p className="text-xs text-[var(--color-muted)]">No related forms found.</p>
        )}
        {trees.length > 0 && (
          <div className="space-y-4">
            {trees.map((tree) => (
              <EvoTreeBranch
                key={monsterRowId(tree.row)}
                node={tree}
                currentId={monsterId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
