import { useCallback, useRef, type PointerEvent } from "react";

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 8;

type Options<T> = {
  /** Fired once after the press is held long enough without moving. */
  onLongPress: (item: T, point: { x: number; y: number }) => void;
};

/**
 * Touch / pen long-press detection. Returns pointer handlers for one list
 * item plus `wasLongPress()` so the following click can be ignored.
 */
export function useLongPress<T>({ onLongPress }: Options<T>) {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const handlersFor = useCallback(
    (item: T) => ({
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        firedRef.current = false;
        if (e.pointerType === "mouse") return;
        cancel();
        startRef.current = { x: e.clientX, y: e.clientY };
        const point = { x: e.clientX, y: e.clientY };
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          firedRef.current = true;
          onLongPress(item, point);
        }, LONG_PRESS_MS);
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const start = startRef.current;
        if (!start) return;
        if (
          Math.abs(e.clientX - start.x) > MOVE_TOLERANCE_PX ||
          Math.abs(e.clientY - start.y) > MOVE_TOLERANCE_PX
        ) {
          cancel();
        }
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
    }),
    [cancel, onLongPress]
  );

  /** True (once) when the last pointer sequence ended in a long press. */
  const consumeLongPress = useCallback(() => {
    const fired = firedRef.current;
    firedRef.current = false;
    return fired;
  }, []);

  return { handlersFor, consumeLongPress };
}
