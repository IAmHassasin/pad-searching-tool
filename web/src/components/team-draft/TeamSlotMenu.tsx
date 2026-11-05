import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { monsterRowId } from "../../lib/filters";
import type { TeamDraftSlotKind } from "../../lib/team-build/team-draft-storage";
import type { TeamBuildConfig } from "../../lib/team-build/types";
import type { MonsterRecord } from "../../types";
import { MonsterPortrait } from "../MonsterPortrait";
import { TEAM_SLOT_INDEXES, teamSlotLabel } from "./team-slot-labels";

export type TeamSlotMenuState = {
  row: MonsterRecord;
  /** Pointer position for the desktop menu; null renders the mobile sheet. */
  point: { x: number; y: number } | null;
};

type Props = {
  state: TeamSlotMenuState;
  draft: TeamBuildConfig;
  onPick: (slotIndex: number, kind: TeamDraftSlotKind) => void;
  onClose: () => void;
};

/** Desktop menu: six slot columns side by side (PAD team order). */
const MENU_WIDTH = 612;
const MENU_MARGIN = 8;
/** Ignore overlay taps / contextmenu this soon after opening (Android long-press tail). */
const OPEN_GRACE_MS = 400;

function SlotThumb({ id }: { id: string }) {
  const n = Number(id);
  if (!id || !Number.isFinite(n) || n <= 0) {
    return (
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-dashed border-[var(--color-border-strong)] text-[9px] text-[var(--color-faint)]"
      >
        +
      </span>
    );
  }
  return (
    <MonsterPortrait
      monsterId={n}
      variant="icon"
      alt=""
      className="h-6 w-6 shrink-0 rounded border border-white/10 object-cover"
    />
  );
}

function SlotButton({
  label,
  currentId,
  accent,
  onClick,
}: {
  label: string;
  currentId: string;
  accent: "monster" | "assist";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={currentId ? `${label} (currently #${currentId})` : label}
      className={`pressable flex min-h-9 min-w-0 flex-1 items-center gap-1 rounded-lg border px-1 text-left text-[10px] font-semibold ${
        accent === "assist"
          ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200 hover:border-emerald-400/60"
          : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-fg)] hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-accent-muted)]"
      }`}
    >
      <SlotThumb id={currentId} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function MenuBody({ state, draft, onPick, onClose, sheet }: Props & { sheet: boolean }) {
  const id = monsterRowId(state.row);
  const name = state.row.name_en?.trim() || state.row.name_jp?.trim() || `#${id}`;
  return (
    <div className={`flex flex-col ${sheet ? "gap-2" : "gap-1.5"}`}>
      <div className="flex items-center gap-2">
        <MonsterPortrait
          monsterId={id}
          variant="icon"
          alt=""
          className="h-8 w-8 shrink-0 rounded-md border border-white/10 object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-[var(--color-fg-strong)]">
            {name}
          </p>
          <p className="font-mono text-[10px] text-[var(--color-muted)]">
            #{id} · add to team slot
          </p>
        </div>
        {sheet && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="pressable flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm text-[var(--color-muted)] hover:bg-white/10"
          >
            ✕
          </button>
        )}
      </div>
      {sheet ? (
        // Touch sheet: one row per slot (easy to tap with a thumb).
        <div className="grid grid-cols-1 gap-1">
          {TEAM_SLOT_INDEXES.map((slot) => {
            const member = draft.members[slot];
            const label = teamSlotLabel(slot);
            const isHelper = slot === TEAM_SLOT_INDEXES.length - 1;
            return (
              <div
                key={slot}
                className={`flex items-center gap-1 ${
                  isHelper ? "mt-1 border-t border-[var(--color-border)] pt-1" : ""
                }`}
              >
                <span className="ds-label w-12 shrink-0 text-[9px]">{label}</span>
                <SlotButton
                  label="Monster"
                  currentId={member?.monsterId ?? ""}
                  accent="monster"
                  onClick={() => onPick(slot, "monster")}
                />
                <SlotButton
                  label="Assist"
                  currentId={member?.eqId ?? ""}
                  accent="assist"
                  onClick={() => onPick(slot, "assist")}
                />
              </div>
            );
          })}
        </div>
      ) : (
        // Desktop menu: slots side by side like the team row (Leader · Sub 1–4 · Helper),
        // Monster on top of Assist in each column.
        <div className="grid grid-cols-6 gap-1">
          {TEAM_SLOT_INDEXES.map((slot) => {
            const member = draft.members[slot];
            const label = teamSlotLabel(slot);
            const leaderish = slot === 0 || slot === TEAM_SLOT_INDEXES.length - 1;
            return (
              <div
                key={slot}
                className={`flex min-w-0 flex-col gap-1 rounded-lg p-1 ${
                  leaderish
                    ? "bg-[var(--color-accent)]/[0.06] ring-1 ring-[var(--color-accent)]/25"
                    : "bg-white/[0.02] ring-1 ring-white/[0.06]"
                }`}
              >
                <span
                  className={`ds-label truncate text-center text-[9px] ${
                    leaderish ? "text-[var(--color-accent-strong)]" : ""
                  }`}
                >
                  {label}
                </span>
                <SlotButton
                  label="Monster"
                  currentId={member?.monsterId ?? ""}
                  accent="monster"
                  onClick={() => onPick(slot, "monster")}
                />
                <SlotButton
                  label="Assist"
                  currentId={member?.eqId ?? ""}
                  accent="assist"
                  onClick={() => onPick(slot, "assist")}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Slot picker opened from a search result (right-click on desktop, long-press
 * on touch). Desktop: floating menu at the pointer; touch: bottom sheet.
 */
export function TeamSlotMenu(props: Props) {
  const { state, onClose } = props;
  const menuRef = useRef<HTMLDivElement>(null);
  const openedAtRef = useRef(Date.now());
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const closeFromOverlay = () => {
    if (Date.now() - openedAtRef.current < OPEN_GRACE_MS) return;
    onClose();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    menuRef.current?.focus({ preventScroll: true });
  }, []);

  // Clamp the desktop menu inside the viewport once its height is known.
  useLayoutEffect(() => {
    if (!state.point) return;
    const el = menuRef.current;
    const height = el?.offsetHeight ?? 320;
    const maxLeft = window.innerWidth - MENU_WIDTH - MENU_MARGIN;
    const maxTop = window.innerHeight - height - MENU_MARGIN;
    setPos({
      left: Math.max(MENU_MARGIN, Math.min(state.point.x, maxLeft)),
      top: Math.max(MENU_MARGIN, Math.min(state.point.y, maxTop)),
    });
  }, [state.point]);

  const point = state.point;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close slot menu"
        className="animate-fade-in fixed inset-0 z-[99] cursor-default bg-black/40"
        onClick={closeFromOverlay}
        onContextMenu={(e) => {
          // Android fires contextmenu ~500 ms into a long-press, after the
          // sheet is already open: swallow it instead of closing.
          e.preventDefault();
        }}
      />
      {point == null ? (
        <div
          ref={menuRef}
          role="dialog"
          tabIndex={-1}
          aria-label="Add to team slot"
          className="ds-float animate-sheet-in fixed inset-x-0 bottom-0 z-[100] max-h-[80vh] overflow-y-auto rounded-t-3xl p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] outline-none"
        >
          <div className="mb-2 flex justify-center" aria-hidden>
            <span className="h-1.5 w-12 rounded-full bg-slate-600" />
          </div>
          <MenuBody {...props} sheet />
        </div>
      ) : (
        <div
          ref={menuRef}
          role="dialog"
          tabIndex={-1}
          aria-label="Add to team slot"
          className="ds-float animate-fade-in fixed z-[100] rounded-xl p-2 outline-none"
          style={{
            width: MENU_WIDTH,
            top: pos?.top ?? point.y,
            left: pos?.left ?? point.x,
            visibility: pos ? "visible" : "hidden",
          }}
        >
          <MenuBody {...props} sheet={false} />
        </div>
      )}
    </>,
    document.body
  );
}
