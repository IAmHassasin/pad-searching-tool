import { useCallback, useRef, useState } from "react";

type Side = "left" | "right";

type UseResizablePanelOptions = {
  /** Unique key for localStorage persistence, e.g. "monster" | "skill". */
  storageKey: string;
  /** Which edge of the panel the drag handle sits on / grows toward. */
  side: Side;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  defaultCollapsed?: boolean;
};

type DragHandleProps = {
  role: "separator";
  "aria-orientation": "vertical";
  "aria-label": string;
  "aria-valuenow": number;
  "aria-valuemin": number;
  "aria-valuemax": number;
  tabIndex: number;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
};

const KEY_STEP = 16;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function widthKey(storageKey: string): string {
  return `pad.panel.${storageKey}.width`;
}
function collapsedKey(storageKey: string): string {
  return `pad.panel.${storageKey}.collapsed`;
}

function readStoredWidth(storageKey: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(widthKey(storageKey));
  const parsed = raw != null ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readStoredCollapsed(storageKey: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(collapsedKey(storageKey));
  return raw != null ? raw === "1" : fallback;
}

/**
 * Drag-to-resize + collapse state for a side panel. Hand-rolled (no
 * resizable-panel library in this project) using Pointer Events with
 * pointer capture, persisted to localStorage, with keyboard support on
 * the returned drag-handle props.
 */
export function useResizablePanel({
  storageKey,
  side,
  defaultWidth,
  minWidth,
  maxWidth,
  defaultCollapsed = false,
}: UseResizablePanelOptions) {
  const [width, setWidth] = useState(() =>
    clamp(
      readStoredWidth(storageKey, defaultWidth),
      minWidth,
      maxWidth
    )
  );
  const [collapsed, setCollapsed] = useState(() =>
    readStoredCollapsed(storageKey, defaultCollapsed)
  );
  const dragState = useRef<{ startX: number; startWidth: number } | null>(
    null
  );

  const persistWidth = useCallback(
    (next: number) => {
      try {
        window.localStorage.setItem(widthKey(storageKey), String(next));
      } catch {
        /* localStorage unavailable (private mode, etc.) — resize still works, just not persisted. */
      }
    },
    [storageKey]
  );

  const persistCollapsed = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(collapsedKey(storageKey), next ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      persistCollapsed(next);
      return next;
    });
  }, [persistCollapsed]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragState.current) return;
      const rawDelta = e.clientX - dragState.current.startX;
      const delta = side === "left" ? rawDelta : -rawDelta;
      setWidth(clamp(dragState.current.startWidth + delta, minWidth, maxWidth));
    },
    [side, minWidth, maxWidth]
  );

  const stopDrag = useCallback(
    (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      el?.releasePointerCapture?.(e.pointerId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
      dragState.current = null;
      setWidth((current) => {
        persistWidth(current);
        return current;
      });
    },
    [onPointerMove, persistWidth]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragState.current = { startX: e.clientX, startWidth: width };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stopDrag);
    },
    [width, onPointerMove, stopDrag]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const grow = side === "left" ? 1 : -1;
      let next: number | null = null;
      if (e.key === "ArrowLeft") next = width - grow * KEY_STEP;
      else if (e.key === "ArrowRight") next = width + grow * KEY_STEP;
      else if (e.key === "Home") next = minWidth;
      else if (e.key === "End") next = maxWidth;
      if (next == null) return;
      e.preventDefault();
      const clamped = clamp(next, minWidth, maxWidth);
      setWidth(clamped);
      persistWidth(clamped);
    },
    [side, width, minWidth, maxWidth, persistWidth]
  );

  const dragHandleProps: DragHandleProps = {
    role: "separator",
    "aria-orientation": "vertical",
    "aria-label": "Resize panel",
    "aria-valuenow": Math.round(width),
    "aria-valuemin": minWidth,
    "aria-valuemax": maxWidth,
    tabIndex: 0,
    onPointerDown,
    onKeyDown,
  };

  return { width, collapsed, toggleCollapsed, dragHandleProps };
}
