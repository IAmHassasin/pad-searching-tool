export type TierItemKind =
  | "card"
  | "attribute"
  | "orb"
  | "awakening"
  | "skillEffect"
  | "filterEffect"
  | "type"
  | "text";

export type TierBadgePosition =
  | "bottom-left"
  | "bottom-right"
  | "bottom"
  | "top-left"
  | "top-right"
  | "below";

export type TierBadgeStyle = {
  textColor: string;
  bgColor: string;
  /** 0–100 */
  bgOpacity: number;
  fontSize: number;
  position: TierBadgePosition;
  bold: boolean;
};

export type TierItem = {
  uid: string;
  kind: TierItemKind;
  /** Monster / sprite id for icon kinds, label for filterEffect, content for text. */
  value: number | string;
  showBadge: boolean;
  /** Empty = default text (card id). */
  badgeText: string;
  /** Per-item overrides on top of the board badge style. */
  badgeStyle: Partial<TierBadgeStyle>;
  /** Icon size override in px; null = board icon size. */
  size: number | null;
};

export type TierColumn = {
  uid: string;
  /** Items per line before wrapping; 0 = never wrap (column grows), null = board default. */
  maxPerLine: number | null;
};

export type TierRow = {
  uid: string;
};

export type TierBoardColors = {
  background: string;
  gridLine: string;
  headerBg: string;
};

export type TierBoard = {
  version: 1;
  title: string;
  rows: TierRow[];
  columns: TierColumn[];
  /** Keyed by `cellKey(row.uid, column.uid)`. */
  cells: Record<string, TierItem[]>;
  iconSize: number;
  gap: number;
  /** Default items per line for columns without an override; 0 = never wrap. */
  maxPerLine: number;
  headerRow: boolean;
  headerCol: boolean;
  showBadgeOnNewCards: boolean;
  badge: TierBadgeStyle;
  colors: TierBoardColors;
};

export const TIER_ITEM_KIND_LABEL: Record<TierItemKind, string> = {
  card: "Card",
  attribute: "Attribute",
  orb: "Orb",
  awakening: "Awakening",
  skillEffect: "Skill effect",
  filterEffect: "Effect",
  type: "Type",
  text: "Text",
};

export const BADGE_POSITIONS: { id: TierBadgePosition; label: string }[] = [
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-right", label: "Bottom right" },
  { id: "bottom", label: "Bottom (full width)" },
  { id: "top-left", label: "Top left" },
  { id: "top-right", label: "Top right" },
  { id: "below", label: "Below icon" },
];

export const DEFAULT_BADGE_STYLE: TierBadgeStyle = {
  textColor: "#ffffff",
  bgColor: "#000000",
  bgOpacity: 75,
  fontSize: 9,
  position: "bottom-left",
  bold: true,
};

export const DEFAULT_BOARD_COLORS: TierBoardColors = {
  background: "#ffffff",
  gridLine: "#c8c8c8",
  headerBg: "#ffffff",
};

let uidCounter = 0;

export function newUid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}${Date.now().toString(36)}${uidCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function cellKey(rowUid: string, colUid: string): string {
  return `${rowUid}|${colUid}`;
}

export function newItem(
  kind: TierItemKind,
  value: number | string,
  showBadge = false
): TierItem {
  return {
    uid: newUid("i"),
    kind,
    value,
    showBadge,
    badgeText: "",
    badgeStyle: {},
    size: null,
  };
}

export function resolveBadgeStyle(
  board: TierBoard,
  item: TierItem
): TierBadgeStyle {
  return { ...board.badge, ...item.badgeStyle };
}

export function itemBadgeText(item: TierItem): string {
  if (item.badgeText.trim()) return item.badgeText;
  return item.kind === "card" ? String(item.value) : "";
}

export function columnMaxPerLine(board: TierBoard, col: TierColumn): number {
  return col.maxPerLine ?? board.maxPerLine;
}

/**
 * Explicit content width for a wrapping cell, so the table cannot squeeze it
 * below `perLine` icons. Null when the cell never wraps or holds text (width unknown).
 */
export function wrappedCellWidth(
  board: TierBoard,
  items: TierItem[],
  perLine: number
): number | null {
  if (perLine <= 0) return null;
  if (items.some((it) => it.kind === "text")) return null;
  const itemWidth = (it: TierItem): number => {
    const icon = it.size ?? board.iconSize;
    const style = resolveBadgeStyle(board, it);
    if (!it.showBadge || style.position !== "below") return icon;
    // Monospace glyphs are ~0.62em wide, plus label padding.
    const label = Math.ceil(itemBadgeText(it).length * style.fontSize * 0.62) + 4;
    return Math.max(icon, label);
  };
  let widest = board.iconSize;
  for (let i = 0; i < items.length; i += perLine) {
    const line = items.slice(i, i + perLine);
    const w =
      line.reduce((sum, it) => sum + itemWidth(it), 0) +
      (line.length - 1) * board.gap;
    widest = Math.max(widest, w);
  }
  return widest;
}

export function hexWithOpacity(hex: string, opacityPct: number): string {
  const alpha = Math.round((Math.min(100, Math.max(0, opacityPct)) / 100) * 255);
  return `${hex}${alpha.toString(16).padStart(2, "0")}`;
}

export function emptyBoard(rowCount: number, colCount: number): TierBoard {
  return {
    version: 1,
    title: "Tier list",
    rows: Array.from({ length: rowCount }, () => ({ uid: newUid("r") })),
    columns: Array.from({ length: colCount }, () => ({
      uid: newUid("c"),
      maxPerLine: null,
    })),
    cells: {},
    iconSize: 40,
    gap: 4,
    maxPerLine: 4,
    headerRow: true,
    headerCol: true,
    showBadgeOnNewCards: true,
    badge: { ...DEFAULT_BADGE_STYLE },
    colors: { ...DEFAULT_BOARD_COLORS },
  };
}

/** Starter layout: header row for effects, header column with the four main orbs. */
export function defaultBoard(): TierBoard {
  const board = emptyBoard(5, 8);
  const headerCol = board.columns[0].uid;
  [1, 2, 3, 4].forEach((orbId, i) => {
    board.cells[cellKey(board.rows[i + 1].uid, headerCol)] = [
      { ...newItem("orb", orbId), size: 32 },
    ];
  });
  return board;
}
