import { useState } from "react";
import { BadgeStyleFields, FIELD_INPUT } from "./BadgeStyleFields";
import {
  addItems,
  clearCell,
  moveItemWithin,
  removeItem,
  updateAllItems,
  updateItem,
} from "./board-ops";
import { IconPickerModal } from "./IconPickerModal";
import { parseIdList } from "./storage";
import { TierItemView } from "./TierItemView";
import {
  newItem,
  resolveBadgeStyle,
  TIER_ITEM_KIND_LABEL,
  type TierBoard,
  type TierItem,
} from "./types";

type Props = {
  board: TierBoard;
  cellKeyValue: string;
  position: { row: number; col: number };
  selectedItemUid: string | null;
  onSelectItem: (uid: string | null) => void;
  onChange: (update: (board: TierBoard) => TierBoard) => void;
};

function ItemStyleEditor({
  board,
  item,
  onPatch,
  onApplyToCell,
}: {
  board: TierBoard;
  item: TierItem;
  onPatch: (patch: Partial<TierItem>) => void;
  onApplyToCell: () => void;
}) {
  const isText = item.kind === "text";
  const style = resolveBadgeStyle(board, item);
  const hasOverrides = Object.keys(item.badgeStyle).length > 0;

  return (
    <div className="space-y-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="ds-label text-[var(--color-accent-strong)]">
          {TIER_ITEM_KIND_LABEL[item.kind]}
          {typeof item.value === "number" ? ` #${item.value}` : !isText && ` ${item.value}`}
        </span>
        {hasOverrides && (
          <button
            type="button"
            onClick={() => onPatch({ badgeStyle: {} })}
            className="text-[10px] font-semibold text-[var(--color-accent-strong)] hover:underline"
          >
            Use board style
          </button>
        )}
      </div>

      {isText ? (
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">Text</span>
          <textarea
            rows={2}
            value={String(item.value)}
            maxLength={200}
            onChange={(e) => onPatch({ value: e.target.value })}
            className="ds-input resize-y px-2 py-1 text-xs"
          />
        </label>
      ) : (
        <>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={item.showBadge}
              onChange={(e) => onPatch({ showBadge: e.target.checked })}
            />
            {item.kind === "card" ? "Show ID highlight" : "Show highlight text"}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="ds-label">Highlight text</span>
              <input
                type="text"
                value={item.badgeText}
                maxLength={60}
                placeholder={item.kind === "card" ? String(item.value) : "Label"}
                onChange={(e) => onPatch({ badgeText: e.target.value })}
                className={FIELD_INPUT}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="ds-label">Icon size</span>
              <input
                type="number"
                min={12}
                max={200}
                value={item.size ?? ""}
                placeholder={String(board.iconSize)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onPatch({
                    size:
                      e.target.value === "" || !Number.isFinite(n)
                        ? null
                        : Math.min(200, Math.max(12, Math.round(n))),
                  });
                }}
                className={FIELD_INPUT}
              />
            </label>
          </div>
        </>
      )}

      <BadgeStyleFields
        value={style}
        onChange={(patch) => onPatch({ badgeStyle: { ...item.badgeStyle, ...patch } })}
      />

      <button
        type="button"
        onClick={onApplyToCell}
        className="ds-btn pressable min-h-8 w-full px-3 text-[11px] font-semibold"
      >
        Apply this style to all items in cell
      </button>
    </div>
  );
}

export function CellEditor({
  board,
  cellKeyValue: key,
  position,
  selectedItemUid,
  onSelectItem,
  onChange,
}: Props) {
  const items = board.cells[key] ?? [];
  const selectedItem = items.find((it) => it.uid === selectedItemUid) ?? null;
  const [idInput, setIdInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [idWarning, setIdWarning] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const addCards = () => {
    const { ids, invalid } = parseIdList(idInput);
    setIdWarning(invalid.length ? `Ignored: ${invalid.join(", ")}` : null);
    if (!ids.length) return;
    onChange((b) =>
      addItems(
        b,
        key,
        ids.map((id) => newItem("card", id, b.showBadgeOnNewCards))
      )
    );
    setIdInput("");
  };

  const addText = () => {
    const text = textInput.trim();
    if (!text) return;
    onChange((b) => addItems(b, key, [newItem("text", text.slice(0, 200))]));
    setTextInput("");
  };

  return (
    <div className="ds-card space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="ds-label text-[var(--color-accent-strong)]">
          Row {position.row + 1} · Column {position.col + 1}
        </h2>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onChange((b) => clearCell(b, key));
              onSelectItem(null);
            }}
            className="text-[10px] font-semibold text-[var(--color-negative)] hover:underline"
          >
            Clear cell
          </button>
        )}
      </div>

      <div>
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">Card IDs</span>
          <span className="flex gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCards();
              }}
              placeholder="e.g. 11735, 13605 14000"
              className={`${FIELD_INPUT} min-w-0 flex-1 font-mono tabular-nums`}
            />
            <button
              type="button"
              onClick={addCards}
              disabled={!idInput.trim()}
              className="ds-btn-primary pressable min-h-8 shrink-0 px-3 text-xs disabled:cursor-not-allowed"
            >
              Add
            </button>
          </span>
        </label>
        {idWarning && (
          <p className="mt-1 text-[10px] text-[var(--color-amber-text)]">{idWarning}</p>
        )}
      </div>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="ds-btn pressable min-h-8 shrink-0 px-3 text-[11px] font-semibold"
        >
          + Icon
        </button>
        <input
          type="text"
          value={textInput}
          maxLength={200}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addText();
          }}
          placeholder="Text label (e.g. S, Tier 1)"
          aria-label="Text label"
          className={`${FIELD_INPUT} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={addText}
          disabled={!textInput.trim()}
          className="ds-btn pressable min-h-8 shrink-0 px-3 text-[11px] font-semibold disabled:cursor-not-allowed"
        >
          + Text
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg bg-[var(--color-inset)] px-2 py-3 text-center text-[11px] text-[var(--color-muted)]">
          Empty cell. Add cards by ID, icons, or text.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => {
            const selected = item.uid === selectedItemUid;
            return (
              <li
                key={item.uid}
                className={`flex items-center gap-2 rounded-lg border px-1.5 py-1 ${
                  selected
                    ? "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)]"
                    : "border-[var(--color-border)] bg-[var(--color-inset)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectItem(selected ? null : item.uid)}
                  aria-pressed={selected}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="flex h-8 min-w-8 shrink-0 items-center justify-center">
                    <TierItemView
                      item={item}
                      size={28}
                      badge={{ ...resolveBadgeStyle(board, item), fontSize: 7 }}
                    />
                  </span>
                  <span className="min-w-0 truncate text-xs">
                    <span className="text-[var(--color-muted)]">
                      {TIER_ITEM_KIND_LABEL[item.kind]}
                    </span>{" "}
                    <span className="font-mono text-[var(--color-fg-strong)]">
                      {typeof item.value === "number" ? `#${item.value}` : item.value}
                    </span>
                  </span>
                </button>
                <span className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    title="Move left"
                    aria-label="Move left"
                    disabled={i === 0}
                    onClick={() => onChange((b) => moveItemWithin(b, key, item.uid, -1))}
                    className="pressable rounded px-1.5 py-0.5 text-xs hover:bg-[var(--color-hover)] disabled:opacity-30"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    title="Move right"
                    aria-label="Move right"
                    disabled={i === items.length - 1}
                    onClick={() => onChange((b) => moveItemWithin(b, key, item.uid, 1))}
                    className="pressable rounded px-1.5 py-0.5 text-xs hover:bg-[var(--color-hover)] disabled:opacity-30"
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    title="Remove"
                    aria-label="Remove"
                    onClick={() => {
                      onChange((b) => removeItem(b, key, item.uid));
                      if (selected) onSelectItem(null);
                    }}
                    className="pressable rounded px-1.5 py-0.5 text-xs text-[var(--color-negative)] hover:bg-[var(--color-hover)]"
                  >
                    ✕
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {selectedItem && (
        <ItemStyleEditor
          board={board}
          item={selectedItem}
          onPatch={(patch) =>
            onChange((b) => updateItem(b, key, selectedItem.uid, patch))
          }
          onApplyToCell={() =>
            onChange((b) =>
              updateAllItems(b, key, (it) => ({
                badgeStyle: { ...selectedItem.badgeStyle },
                ...(it.kind === "text" ? {} : { showBadge: selectedItem.showBadge }),
              }))
            )
          }
        />
      )}

      {pickerOpen && (
        <IconPickerModal
          onPick={(kind, value) => onChange((b) => addItems(b, key, [newItem(kind, value)]))}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
