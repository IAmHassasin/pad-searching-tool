import {
  cellKey,
  newUid,
  type TierBoard,
  type TierColumn,
  type TierItem,
} from "./types";

function moveInArray<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function withoutCells(
  cells: TierBoard["cells"],
  matches: (key: string) => boolean
): TierBoard["cells"] {
  const next: TierBoard["cells"] = {};
  for (const [key, items] of Object.entries(cells)) {
    if (!matches(key)) next[key] = items;
  }
  return next;
}

export function insertRow(board: TierBoard, index: number): TierBoard {
  const rows = [...board.rows];
  rows.splice(index, 0, { uid: newUid("r") });
  return { ...board, rows };
}

export function removeRow(board: TierBoard, index: number): TierBoard {
  if (board.rows.length <= 1) return board;
  const uid = board.rows[index].uid;
  return {
    ...board,
    rows: board.rows.filter((_, i) => i !== index),
    cells: withoutCells(board.cells, (key) => key.startsWith(`${uid}|`)),
  };
}

export function moveRow(board: TierBoard, index: number, delta: number): TierBoard {
  return { ...board, rows: moveInArray(board.rows, index, index + delta) };
}

export function insertColumn(board: TierBoard, index: number): TierBoard {
  const columns = [...board.columns];
  columns.splice(index, 0, { uid: newUid("c"), maxPerLine: null });
  return { ...board, columns };
}

export function removeColumn(board: TierBoard, index: number): TierBoard {
  if (board.columns.length <= 1) return board;
  const uid = board.columns[index].uid;
  return {
    ...board,
    columns: board.columns.filter((_, i) => i !== index),
    cells: withoutCells(board.cells, (key) => key.endsWith(`|${uid}`)),
  };
}

export function moveColumn(
  board: TierBoard,
  index: number,
  delta: number
): TierBoard {
  return { ...board, columns: moveInArray(board.columns, index, index + delta) };
}

export function updateColumn(
  board: TierBoard,
  index: number,
  patch: Partial<TierColumn>
): TierBoard {
  return {
    ...board,
    columns: board.columns.map((c, i) => (i === index ? { ...c, ...patch } : c)),
  };
}

function setCell(board: TierBoard, key: string, items: TierItem[]): TierBoard {
  const cells = { ...board.cells };
  if (items.length) cells[key] = items;
  else delete cells[key];
  return { ...board, cells };
}

export function addItems(board: TierBoard, key: string, items: TierItem[]): TierBoard {
  return setCell(board, key, [...(board.cells[key] ?? []), ...items]);
}

export function updateItem(
  board: TierBoard,
  key: string,
  uid: string,
  patch: Partial<TierItem>
): TierBoard {
  return setCell(
    board,
    key,
    (board.cells[key] ?? []).map((it) => (it.uid === uid ? { ...it, ...patch } : it))
  );
}

export function updateAllItems(
  board: TierBoard,
  key: string,
  patch: (item: TierItem) => Partial<TierItem>
): TierBoard {
  return setCell(
    board,
    key,
    (board.cells[key] ?? []).map((it) => ({ ...it, ...patch(it) }))
  );
}

export function removeItem(board: TierBoard, key: string, uid: string): TierBoard {
  return setCell(
    board,
    key,
    (board.cells[key] ?? []).filter((it) => it.uid !== uid)
  );
}

export function clearCell(board: TierBoard, key: string): TierBoard {
  return setCell(board, key, []);
}

export function moveItemWithin(
  board: TierBoard,
  key: string,
  uid: string,
  delta: number
): TierBoard {
  const items = board.cells[key] ?? [];
  const from = items.findIndex((it) => it.uid === uid);
  if (from < 0) return board;
  return setCell(board, key, moveInArray(items, from, from + delta));
}

/** Moves an item to the end of another cell (or reorders within the same cell). */
export function moveItemToCell(
  board: TierBoard,
  fromKey: string,
  uid: string,
  toKey: string,
  beforeUid: string | null = null
): TierBoard {
  const item = (board.cells[fromKey] ?? []).find((it) => it.uid === uid);
  if (!item || beforeUid === uid) return board;
  const removed = setCell(
    board,
    fromKey,
    (board.cells[fromKey] ?? []).filter((it) => it.uid !== uid)
  );
  const target = [...(removed.cells[toKey] ?? [])];
  const at = beforeUid ? target.findIndex((it) => it.uid === beforeUid) : -1;
  if (at >= 0) target.splice(at, 0, item);
  else target.push(item);
  return setCell(removed, toKey, target);
}

export function cellPosition(
  board: TierBoard,
  key: string
): { row: number; col: number } | null {
  for (let r = 0; r < board.rows.length; r++) {
    for (let c = 0; c < board.columns.length; c++) {
      if (cellKey(board.rows[r].uid, board.columns[c].uid) === key) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}
