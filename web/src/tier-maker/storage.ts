import {
  BADGE_POSITIONS,
  DEFAULT_BADGE_STYLE,
  DEFAULT_BOARD_COLORS,
  newUid,
  type TierBadgeStyle,
  type TierBoard,
  type TierColumn,
  type TierItem,
  type TierItemKind,
  type TierRow,
} from "./types";

const STORAGE_KEY = "pst.tier-maker.board.v1";

const ITEM_KINDS = new Set<TierItemKind>([
  "card",
  "attribute",
  "orb",
  "awakening",
  "skillEffect",
  "filterEffect",
  "type",
  "text",
]);

const POSITION_IDS = new Set(BADGE_POSITIONS.map((p) => p.id));

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

type Raw = Record<string, unknown>;

function isObject(v: unknown): v is Raw {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback: string, maxLen = 200): string {
  return typeof v === "string" ? v.slice(0, maxLen) : fallback;
}

function color(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX_COLOR.test(v) ? v.toLowerCase() : fallback;
}

function int(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function uid(v: unknown, prefix: string): string {
  return typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : newUid(prefix);
}

function sanitizeBadgePartial(v: unknown): Partial<TierBadgeStyle> {
  if (!isObject(v)) return {};
  const out: Partial<TierBadgeStyle> = {};
  if ("textColor" in v) out.textColor = color(v.textColor, DEFAULT_BADGE_STYLE.textColor);
  if ("bgColor" in v) out.bgColor = color(v.bgColor, DEFAULT_BADGE_STYLE.bgColor);
  if ("bgOpacity" in v) out.bgOpacity = int(v.bgOpacity, DEFAULT_BADGE_STYLE.bgOpacity, 0, 100);
  if ("fontSize" in v) out.fontSize = int(v.fontSize, DEFAULT_BADGE_STYLE.fontSize, 6, 32);
  if ("position" in v && POSITION_IDS.has(v.position as TierBadgeStyle["position"])) {
    out.position = v.position as TierBadgeStyle["position"];
  }
  if ("bold" in v) out.bold = v.bold === true;
  return out;
}

function sanitizeItem(v: unknown): TierItem | null {
  if (!isObject(v) || !ITEM_KINDS.has(v.kind as TierItemKind)) return null;
  const kind = v.kind as TierItemKind;
  const textual = kind === "filterEffect" || kind === "text";
  let value: number | string;
  if (textual) {
    value = str(v.value, "", 200);
  } else {
    value = int(v.value, 0, 0, 999_999);
    if (kind !== "attribute" && kind !== "type" && value <= 0) return null;
  }
  return {
    uid: uid(v.uid, "i"),
    kind,
    value,
    showBadge: v.showBadge === true,
    badgeText: str(v.badgeText, "", 60),
    badgeStyle: sanitizeBadgePartial(v.badgeStyle),
    size: v.size == null ? null : int(v.size, 40, 12, 200),
  };
}

export function sanitizeBoard(v: unknown): TierBoard | null {
  if (!isObject(v) || !Array.isArray(v.rows) || !Array.isArray(v.columns)) {
    return null;
  }
  const rows: TierRow[] = v.rows
    .slice(0, 200)
    .map((r) => ({ uid: uid(isObject(r) ? r.uid : null, "r") }));
  const columns: TierColumn[] = v.columns.slice(0, 200).map((c) => ({
    uid: uid(isObject(c) ? c.uid : null, "c"),
    maxPerLine:
      isObject(c) && c.maxPerLine != null ? int(c.maxPerLine, 0, 0, 100) : null,
  }));
  if (!rows.length || !columns.length) return null;

  const validKeys = new Set<string>();
  for (const r of rows) for (const c of columns) validKeys.add(`${r.uid}|${c.uid}`);

  const cells: TierBoard["cells"] = {};
  if (isObject(v.cells)) {
    for (const [key, list] of Object.entries(v.cells)) {
      if (!validKeys.has(key) || !Array.isArray(list)) continue;
      const items = list
        .slice(0, 500)
        .map(sanitizeItem)
        .filter((i): i is TierItem => i !== null);
      if (items.length) cells[key] = items;
    }
  }

  const colors = isObject(v.colors) ? v.colors : {};
  return {
    version: 1,
    title: str(v.title, "Tier list", 120),
    rows,
    columns,
    cells,
    iconSize: int(v.iconSize, 40, 16, 160),
    gap: int(v.gap, 4, 0, 32),
    maxPerLine: int(v.maxPerLine, 4, 0, 100),
    headerRow: v.headerRow !== false,
    headerCol: v.headerCol !== false,
    showBadgeOnNewCards: v.showBadgeOnNewCards !== false,
    badge: { ...DEFAULT_BADGE_STYLE, ...sanitizeBadgePartial(v.badge) },
    colors: {
      background: color(colors.background, DEFAULT_BOARD_COLORS.background),
      gridLine: color(colors.gridLine, DEFAULT_BOARD_COLORS.gridLine),
      headerBg: color(colors.headerBg, DEFAULT_BOARD_COLORS.headerBg),
    },
  };
}

export function loadStoredBoard(): TierBoard | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeBoard(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Returns false when storage is unavailable or full. */
export function storeBoard(board: TierBoard): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
    return true;
  } catch {
    return false;
  }
}

export function parseBoardJson(text: string): TierBoard | null {
  try {
    return sanitizeBoard(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Parses "11735, 13605 14000" style input into positive integer ids. */
export function parseIdList(raw: string): { ids: number[]; invalid: string[] } {
  const ids: number[] = [];
  const invalid: string[] = [];
  for (const token of raw.split(/[\s,;]+/)) {
    if (!token) continue;
    const n = Number(token);
    if (Number.isInteger(n) && n > 0 && n <= 999_999) ids.push(n);
    else invalid.push(token);
  }
  return { ids, invalid };
}
