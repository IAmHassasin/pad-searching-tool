import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { exportElementToPng } from "../custom-card/export-png";
import { BadgeStyleFields, ColorField, FIELD_INPUT } from "./BadgeStyleFields";
import {
  cellPosition,
  insertColumn,
  insertRow,
  moveColumn,
  moveItemToCell,
  moveRow,
  removeColumn,
  removeRow,
  updateColumn,
} from "./board-ops";
import { CellEditor } from "./CellEditor";
import { loadStoredBoard, parseBoardJson, storeBoard } from "./storage";
import { TierItemView } from "./TierItemView";
import {
  cellKey,
  columnMaxPerLine,
  defaultBoard,
  resolveBadgeStyle,
  wrappedCellWidth,
  type TierBoard,
} from "./types";

const DRAG_MIME = "application/x-pst-tier-item";

const CONTROL_BTN =
  "pressable rounded px-1 text-[11px] leading-5 text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg-strong)] disabled:opacity-30";

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (raw === "" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function safeFilename(title: string, ext: string): string {
  const base = title.trim().replace(/[^\w\-]+/g, "_").slice(0, 40) || "tier-list";
  return `${base}.${ext}`;
}

type BoardUpdate = (update: (board: TierBoard) => TierBoard) => void;

function ColumnControls({
  board,
  index: c,
  onChange,
}: {
  board: TierBoard;
  index: number;
  onChange: BoardUpdate;
}) {
  const col = board.columns[c];
  const colCount = board.columns.length;
  return (
    <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
      <button
        type="button"
        title="Move column left"
        aria-label={`Move column ${c + 1} left`}
        disabled={c === 0}
        onClick={() => onChange((b) => moveColumn(b, c, -1))}
        className={CONTROL_BTN}
      >
        ◀
      </button>
      <input
        type="number"
        min={0}
        max={100}
        value={col.maxPerLine ?? ""}
        placeholder={String(board.maxPerLine)}
        title="Icons per line (blank = board default, 0 = never wrap)"
        aria-label={`Column ${c + 1} icons per line`}
        onChange={(e) =>
          onChange((b) =>
            updateColumn(b, c, {
              maxPerLine:
                e.target.value === "" ? null : clampInt(e.target.value, 0, 100, 0),
            })
          )
        }
        className="ds-input h-6 w-10 px-1 text-center text-[11px]"
      />
      <button
        type="button"
        title="Insert column after"
        aria-label={`Insert column after column ${c + 1}`}
        onClick={() => onChange((b) => insertColumn(b, c + 1))}
        className={CONTROL_BTN}
      >
        +
      </button>
      <button
        type="button"
        title="Move column right"
        aria-label={`Move column ${c + 1} right`}
        disabled={c === colCount - 1}
        onClick={() => onChange((b) => moveColumn(b, c, 1))}
        className={CONTROL_BTN}
      >
        ▶
      </button>
      <button
        type="button"
        title="Delete column"
        aria-label={`Delete column ${c + 1}`}
        disabled={colCount <= 1}
        onClick={() => {
          const hasItems = Object.keys(board.cells).some((k) => k.endsWith(`|${col.uid}`));
          if (hasItems && !window.confirm("Delete this column and its items?")) return;
          onChange((b) => removeColumn(b, c));
        }}
        className={`${CONTROL_BTN} hover:!text-[var(--color-negative)]`}
      >
        ✕
      </button>
    </div>
  );
}

function RowControls({
  board,
  index: r,
  onChange,
}: {
  board: TierBoard;
  index: number;
  onChange: BoardUpdate;
}) {
  const row = board.rows[r];
  const rowCount = board.rows.length;
  return (
    <div className="grid grid-cols-2 gap-0.5">
      <button
        type="button"
        title="Move row up"
        aria-label={`Move row ${r + 1} up`}
        disabled={r === 0}
        onClick={() => onChange((b) => moveRow(b, r, -1))}
        className={CONTROL_BTN}
      >
        ▲
      </button>
      <button
        type="button"
        title="Insert row below"
        aria-label={`Insert row below row ${r + 1}`}
        onClick={() => onChange((b) => insertRow(b, r + 1))}
        className={CONTROL_BTN}
      >
        +
      </button>
      <button
        type="button"
        title="Move row down"
        aria-label={`Move row ${r + 1} down`}
        disabled={r === rowCount - 1}
        onClick={() => onChange((b) => moveRow(b, r, 1))}
        className={CONTROL_BTN}
      >
        ▼
      </button>
      <button
        type="button"
        title="Delete row"
        aria-label={`Delete row ${r + 1}`}
        disabled={rowCount <= 1}
        onClick={() => {
          const hasItems = Object.keys(board.cells).some((k) => k.startsWith(`${row.uid}|`));
          if (hasItems && !window.confirm("Delete this row and its items?")) return;
          onChange((b) => removeRow(b, r));
        }}
        className={`${CONTROL_BTN} hover:!text-[var(--color-negative)]`}
      >
        ✕
      </button>
    </div>
  );
}

function BoardSettings({
  board,
  onChange,
}: {
  board: TierBoard;
  onChange: BoardUpdate;
}) {
  const set = (patch: Partial<TierBoard>) => onChange((b) => ({ ...b, ...patch }));
  return (
    <div className="ds-card space-y-3 p-3">
      <h2 className="ds-label">Board settings</h2>
      <label className="flex flex-col gap-0.5">
        <span className="ds-label">Title (file name)</span>
        <input
          type="text"
          value={board.title}
          maxLength={120}
          onChange={(e) => set({ title: e.target.value })}
          className={FIELD_INPUT}
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">Icon px</span>
          <input
            type="number"
            min={16}
            max={160}
            value={board.iconSize}
            onChange={(e) =>
              set({ iconSize: clampInt(e.target.value, 16, 160, board.iconSize) })
            }
            className={FIELD_INPUT}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">Gap px</span>
          <input
            type="number"
            min={0}
            max={32}
            value={board.gap}
            onChange={(e) => set({ gap: clampInt(e.target.value, 0, 32, board.gap) })}
            className={FIELD_INPUT}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="ds-label" title="0 = never wrap; column grows">
            Per line
          </span>
          <input
            type="number"
            min={0}
            max={100}
            value={board.maxPerLine}
            onChange={(e) =>
              set({ maxPerLine: clampInt(e.target.value, 0, 100, board.maxPerLine) })
            }
            className={FIELD_INPUT}
          />
        </label>
      </div>
      <p className="text-[10px] text-[var(--color-muted)]">
        Per line: icons per line before wrapping. 0 = never wrap (cell widens).
        Each column can override this from its header controls.
      </p>
      <div className="space-y-1.5 text-xs">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={board.headerRow}
            onChange={(e) => set({ headerRow: e.target.checked })}
          />
          First row is header
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={board.headerCol}
            onChange={(e) => set({ headerCol: e.target.checked })}
          />
          First column is header
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={board.showBadgeOnNewCards}
            onChange={(e) => set({ showBadgeOnNewCards: e.target.checked })}
          />
          Show ID highlight on new cards
        </label>
      </div>
      <div className="space-y-2 border-t border-[var(--color-border)] pt-2">
        <span className="ds-label">Board colors</span>
        <ColorField
          label="Background"
          value={board.colors.background}
          onChange={(background) =>
            onChange((b) => ({ ...b, colors: { ...b.colors, background } }))
          }
        />
        <ColorField
          label="Grid lines"
          value={board.colors.gridLine}
          onChange={(gridLine) =>
            onChange((b) => ({ ...b, colors: { ...b.colors, gridLine } }))
          }
        />
        <ColorField
          label="Header cells"
          value={board.colors.headerBg}
          onChange={(headerBg) =>
            onChange((b) => ({ ...b, colors: { ...b.colors, headerBg } }))
          }
        />
      </div>
      <div className="space-y-2 border-t border-[var(--color-border)] pt-2">
        <span className="ds-label">Default highlight style</span>
        <BadgeStyleFields
          value={board.badge}
          onChange={(patch) => onChange((b) => ({ ...b, badge: { ...b.badge, ...patch } }))}
        />
      </div>
    </div>
  );
}

export function TierMakerPage() {
  const [board, setBoard] = useState<TierBoard>(() => loadStoredBoard() ?? defaultBoard());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedItemUid, setSelectedItemUid] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSaveFailed(!storeBoard(board));
  }, [board]);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2500);
  };

  const selectedPos = useMemo(
    () => (selectedKey ? cellPosition(board, selectedKey) : null),
    [board, selectedKey]
  );

  const selectCell = (key: string, itemUid: string | null = null) => {
    setSelectedKey(key);
    setSelectedItemUid(itemUid);
  };

  const handleExportPng = async () => {
    const el = boardRef.current;
    if (!el) return;
    setExporting(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      await exportElementToPng(el, safeFilename(board.title, "png"));
    } catch (e) {
      flash(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(board, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFilename(board.title, "json");
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const handleImportFile = async (file: File) => {
    const next = parseBoardJson(await file.text());
    if (!next) {
      flash("Invalid tier list file");
      return;
    }
    setBoard(next);
    setSelectedKey(null);
    setSelectedItemUid(null);
    flash("Tier list imported");
  };

  const handleReset = () => {
    if (!window.confirm("Reset the board? This clears all rows, columns and items.")) return;
    setBoard(defaultBoard());
    setSelectedKey(null);
    setSelectedItemUid(null);
  };

  const onItemDragStart = (e: DragEvent, fromKey: string, uid: string) => {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ fromKey, uid }));
    e.dataTransfer.effectAllowed = "move";
  };

  const onCellDrop = (e: DragEvent, toKey: string, beforeUid: string | null) => {
    setDropKey(null);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const { fromKey, uid } = JSON.parse(raw) as { fromKey: string; uid: string };
      setBoard((b) => moveItemToCell(b, fromKey, uid, toKey, beforeUid));
      selectCell(toKey, uid);
    } catch {
      flash("Could not move item");
    }
  };

  const editing = !exporting;
  const { iconSize, gap, colors } = board;

  return (
    <div className="flex h-full flex-col bg-[var(--color-surface)] text-[var(--color-fg)]">
      <PageHeader
        title="Tier Maker"
        subtitle="Build tier tables with cards, attributes and effects"
        maxWidthClass="max-w-7xl"
        actions={
          <>
            {message && (
              <span className="hidden text-[11px] text-[var(--color-secondary-strong)] sm:inline">
                {message}
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleExportPng()}
              disabled={exporting}
              className="ds-btn-primary pressable min-h-9 px-3 text-xs disabled:cursor-wait"
            >
              {exporting ? "Exporting…" : "Export PNG"}
            </button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBoard((b) => insertRow(b, b.rows.length))}
                className="ds-btn pressable min-h-8 px-3 text-[11px] font-semibold"
              >
                + Row
              </button>
              <button
                type="button"
                onClick={() => setBoard((b) => insertColumn(b, b.columns.length))}
                className="ds-btn pressable min-h-8 px-3 text-[11px] font-semibold"
              >
                + Column
              </button>
              <span className="mx-1 h-5 w-px bg-[var(--color-border)]" aria-hidden />
              <button
                type="button"
                onClick={handleExportJson}
                className="ds-btn pressable min-h-8 px-3 text-[11px] font-semibold"
              >
                Save JSON
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ds-btn pressable min-h-8 px-3 text-[11px] font-semibold"
              >
                Load JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                aria-label="Load tier list JSON"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleImportFile(file);
                }}
              />
              <button
                type="button"
                onClick={handleReset}
                className="pressable min-h-8 rounded-lg px-3 text-[11px] font-semibold text-[var(--color-negative)] hover:bg-[var(--color-hover)]"
              >
                Reset
              </button>
              {message && (
                <span className="text-[11px] text-[var(--color-secondary-strong)] sm:hidden">
                  {message}
                </span>
              )}
            </div>
            {saveFailed && (
              <p className="text-[11px] text-[var(--color-amber-text)]">
                Browser storage is unavailable — use Save JSON to keep your board.
              </p>
            )}
            <p className="text-[10px] text-[var(--color-faint)]">
              Click a cell to edit it. Drag icons between cells to move them.
              Changes are saved in this browser automatically.
            </p>

            <div className="overflow-auto rounded-lg pb-2">
              <div ref={boardRef} className="inline-block align-top">
              <table className="border-separate border-spacing-0">
                {editing && (
                  <thead>
                    <tr>
                      <th aria-hidden />
                      {board.columns.map((col, c) => (
                        <th key={col.uid} className="px-0.5 pb-1 align-bottom font-normal">
                          {selectedPos?.col === c ? (
                            <ColumnControls
                              board={board}
                              index={c}
                              onChange={setBoard}
                            />
                          ) : (
                            <span className="block text-center font-mono text-[10px] text-[var(--color-faint)]">
                              {c + 1}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {board.rows.map((row, r) => (
                    <tr key={row.uid}>
                      {editing && (
                        <th className="pr-1 align-middle font-normal">
                          {selectedPos?.row === r ? (
                            <RowControls board={board} index={r} onChange={setBoard} />
                          ) : (
                            <span className="block text-right font-mono text-[10px] text-[var(--color-faint)]">
                              {r + 1}
                            </span>
                          )}
                        </th>
                      )}
                      {board.columns.map((col, c) => {
                        const key = cellKey(row.uid, col.uid);
                        const items = board.cells[key] ?? [];
                        const isHeader =
                          (board.headerRow && r === 0) || (board.headerCol && c === 0);
                        const perLine = columnMaxPerLine(board, col);
                        const wrapWidth = wrappedCellWidth(board, items, perLine);
                        const selected = editing && key === selectedKey;
                        const dropping = editing && key === dropKey;
                        return (
                          <td
                            key={col.uid}
                            onClick={() => editing && selectCell(key)}
                            onDragOver={(e) => {
                              if (!editing || !e.dataTransfer.types.includes(DRAG_MIME)) return;
                              e.preventDefault();
                              setDropKey(key);
                            }}
                            onDragLeave={() => setDropKey((k) => (k === key ? null : k))}
                            onDrop={(e) => onCellDrop(e, key, null)}
                            className={editing ? "cursor-pointer" : undefined}
                            style={{
                              backgroundColor: isHeader ? colors.headerBg : colors.background,
                              borderStyle: "solid",
                              borderColor: colors.gridLine,
                              borderWidth: `${r === 0 ? 1 : 0}px 1px 1px ${c === 0 ? 1 : 0}px`,
                              padding: gap + 2,
                              verticalAlign: "middle",
                              outline: selected
                                ? "2px solid var(--color-accent)"
                                : dropping
                                  ? "2px dashed var(--color-accent)"
                                  : undefined,
                              outlineOffset: -2,
                            }}
                          >
                            <div
                              className="flex items-center"
                              style={{
                                flexWrap: perLine > 0 ? "wrap" : "nowrap",
                                justifyContent: isHeader ? "center" : "flex-start",
                                gap,
                                width: wrapWidth ?? undefined,
                                minWidth: iconSize,
                                minHeight: iconSize,
                                maxWidth:
                                  wrapWidth == null && perLine > 0
                                    ? perLine * iconSize + (perLine - 1) * gap
                                    : undefined,
                                margin: isHeader ? "0 auto" : undefined,
                              }}
                            >
                              {items.map((item) => (
                                <span
                                  key={item.uid}
                                  draggable={editing}
                                  onDragStart={(e) => onItemDragStart(e, key, item.uid)}
                                  onDrop={(e) => onCellDrop(e, key, item.uid)}
                                  onClick={(e) => {
                                    if (!editing) return;
                                    e.stopPropagation();
                                    selectCell(key, item.uid);
                                  }}
                                  className="inline-flex"
                                  style={{
                                    outline:
                                      editing && item.uid === selectedItemUid
                                        ? "2px solid var(--color-secondary)"
                                        : undefined,
                                    outlineOffset: 1,
                                    borderRadius: 3,
                                  }}
                                >
                                  <TierItemView
                                    item={item}
                                    size={item.size ?? iconSize}
                                    badge={resolveBadgeStyle(board, item)}
                                  />
                                </span>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

          </div>

          <aside className="space-y-3">
            {selectedKey && selectedPos ? (
              <CellEditor
                key={selectedKey}
                board={board}
                cellKeyValue={selectedKey}
                position={selectedPos}
                selectedItemUid={selectedItemUid}
                onSelectItem={setSelectedItemUid}
                onChange={setBoard}
              />
            ) : (
              <div className="ds-card p-3 text-center text-xs text-[var(--color-muted)]">
                Select a cell to add cards, icons or text.
              </div>
            )}
            <BoardSettings board={board} onChange={setBoard} />
          </aside>
        </div>
      </div>
    </div>
  );
}
