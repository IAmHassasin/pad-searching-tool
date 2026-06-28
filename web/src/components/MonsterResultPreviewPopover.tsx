import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { monsterRowId } from "../lib/filters";
import type { MonsterRecord } from "../types";
import { MonsterQuickPreview } from "./MonsterQuickPreview";

const SHOW_DELAY_MS = 150;
const POPOVER_WIDTH = 360;
const POPOVER_MARGIN = 8;

type PreviewState = {
  row: MonsterRecord;
  anchorRect: DOMRect;
  pinned: boolean;
};

function canUseHoverPreview(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function computePopoverPosition(anchorRect: DOMRect): { top: number; left: number } {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  let left = anchorRect.right + POPOVER_MARGIN;
  if (left + POPOVER_WIDTH > viewportW - POPOVER_MARGIN) {
    left = anchorRect.left - POPOVER_WIDTH - POPOVER_MARGIN;
  }
  if (left < POPOVER_MARGIN) {
    left = Math.min(
      POPOVER_MARGIN,
      Math.max(POPOVER_MARGIN, anchorRect.left)
    );
  }

  let top = anchorRect.top;
  const estimatedHeight = 320;
  if (top + estimatedHeight > viewportH - POPOVER_MARGIN) {
    top = Math.max(POPOVER_MARGIN, viewportH - estimatedHeight - POPOVER_MARGIN);
  }

  return { top, left };
}

type FloatingPreviewProps = {
  state: PreviewState;
  previewId: string;
  onClose: () => void;
};

function MonsterPreviewFloating({ state, previewId, onClose }: FloatingPreviewProps) {
  const { top, left } = computePopoverPosition(state.anchorRect);

  return createPortal(
    <>
      {state.pinned && (
        <button
          type="button"
          aria-label="Close preview"
          className="fixed inset-0 z-[99] cursor-default bg-black/20"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed z-[100] ${state.pinned ? "pointer-events-auto" : "pointer-events-none"}`}
        style={{ top, left, width: POPOVER_WIDTH }}
      >
        <MonsterQuickPreview row={state.row} id={previewId} />
      </div>
    </>,
    document.body
  );
}

export function MonsterPreviewInfoButton({
  onClick,
  describedBy,
}: {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Quick preview"
      aria-describedby={describedBy}
      className="shrink-0 rounded px-1 py-0.5 text-[10px] leading-none text-[var(--color-muted)] hover:bg-[#21262d] hover:text-[var(--color-accent)]"
    >
      ⓘ
    </button>
  );
}

export function useMonsterResultPreview() {
  const previewId = useId();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCapableRef = useRef(canUseHoverPreview());

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const closePreview = useCallback(() => {
    clearShowTimer();
    setPreview(null);
  }, [clearShowTimer]);

  const openPreview = useCallback(
    (row: MonsterRecord, anchor: HTMLElement, pinned: boolean) => {
      clearShowTimer();
      setPreview({
        row,
        anchorRect: anchor.getBoundingClientRect(),
        pinned,
      });
    },
    [clearShowTimer]
  );

  const scheduleHoverPreview = useCallback(
    (row: MonsterRecord, anchor: HTMLElement) => {
      if (!hoverCapableRef.current) return;
      clearShowTimer();
      showTimerRef.current = setTimeout(() => {
        openPreview(row, anchor, false);
      }, SHOW_DELAY_MS);
    },
    [clearShowTimer, openPreview]
  );

  const bindRowPreview = useCallback(
    (row: MonsterRecord) => {
      const rowId = monsterRowId(row);

      const onMouseEnter = (e: MouseEvent<HTMLTableRowElement>) => {
        scheduleHoverPreview(row, e.currentTarget);
      };

      const onMouseLeave = () => {
        clearShowTimer();
        setPreview((current) => {
          if (!current || current.pinned) return current;
          return monsterRowId(current.row) === rowId ? null : current;
        });
      };

      const onFocus = (e: FocusEvent<HTMLTableRowElement>) => {
        if (!hoverCapableRef.current) return;
        openPreview(row, e.currentTarget, false);
      };

      const onBlur = (e: FocusEvent<HTMLTableRowElement>) => {
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) return;
        setPreview((current) =>
          current && monsterRowId(current.row) === rowId && !current.pinned
            ? null
            : current
        );
      };

      const isPreviewTarget =
        preview != null && monsterRowId(preview.row) === rowId;

      return {
        onMouseEnter,
        onMouseLeave,
        onFocus,
        onBlur,
        tabIndex: 0,
        "aria-describedby": isPreviewTarget ? previewId : undefined,
      };
    },
    [clearShowTimer, openPreview, preview, previewId, scheduleHoverPreview]
  );

  const openPinnedPreview = useCallback(
    (row: MonsterRecord, anchor: HTMLElement) => {
      openPreview(row, anchor, true);
    },
    [openPreview]
  );

  useEffect(() => {
    if (!preview) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
    };

    const onScroll = () => {
      if (!preview.pinned) closePreview();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [preview, closePreview]);

  useEffect(() => () => clearShowTimer(), [clearShowTimer]);

  return {
    preview,
    previewId,
    bindRowPreview,
    openPinnedPreview,
    closePreview,
    hoverCapable: hoverCapableRef.current,
  };
}

export function MonsterResultPreviewFloating({
  preview,
  previewId,
  onClose,
}: {
  preview: PreviewState | null;
  previewId: string;
  onClose: () => void;
}) {
  if (!preview) return null;
  return (
    <MonsterPreviewFloating
      state={preview}
      previewId={previewId}
      onClose={onClose}
    />
  );
}
