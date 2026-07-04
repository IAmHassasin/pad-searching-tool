import {
  useCallback,
  useEffect,
  useId,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import type { MonsterRecord } from "../types";
import { MonsterQuickPreview } from "./MonsterQuickPreview";

const POPOVER_WIDTH = 360;
const POPOVER_MARGIN = 8;

type PreviewState = {
  row: MonsterRecord;
  anchorRect: DOMRect;
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
      <button
        type="button"
        aria-label="Close preview"
        className="fixed inset-0 z-[99] cursor-default bg-black/20"
        onClick={onClose}
      />
      <div
        className="pointer-events-auto fixed z-[100]"
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
  const hoverCapableRef = canUseHoverPreview();

  const closePreview = useCallback(() => {
    setPreview(null);
  }, []);

  const openPinnedPreview = useCallback((row: MonsterRecord, anchor: HTMLElement) => {
    setPreview({
      row,
      anchorRect: anchor.getBoundingClientRect(),
    });
  }, []);

  useEffect(() => {
    if (!preview) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview, closePreview]);

  return {
    preview,
    previewId,
    openPinnedPreview,
    closePreview,
    hoverCapable: hoverCapableRef,
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
