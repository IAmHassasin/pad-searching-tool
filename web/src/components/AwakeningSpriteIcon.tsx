import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import {
  awakeningFallbackImageUrl,
  awakeningSpriteStyle,
} from "../lib/awakening-sprite";
import { PAD_AWAKENING } from "../lib/pad-constants";
import { AwakeningEffectPopover } from "./AwakeningEffectPopover";

export type AwakeningSpriteIconProps = {
  awokenSkillId: number;
  /** Display size in px (square). Defaults to manifest tile width. */
  size?: number;
  label?: string;
  title?: string;
  /** Applied to the anchor; its `display` is fixed to inline-flex. */
  className?: string;
};

const frameClass =
  "shrink-0 rounded-sm border border-[#6b8f3c]/80 bg-[#2a3d18] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]";

/**
 * The anchor wraps the icon so the popover can be attached. It must be
 * inline-flex (set inline so caller classes like `inline-block` cannot
 * override it): an inline-block wrapper creates a line box whose height
 * follows the inherited line-height, which pushes the icon off-center inside
 * fixed-size buttons and flex rows.
 */
const anchorStyle: CSSProperties = { display: "inline-flex", lineHeight: 0 };

const HOVER_OPEN_MS = 280;
const CLOSE_MS = 120;

/** Only one awakening popover is shown at a time across the page. */
let activePopover: { id: string; close: () => void } | null = null;

/**
 * Touch "hover": the finger shows the popover on contact and switches it when
 * sliding onto another awakening icon. Pointer capture is released on
 * pointerdown so boundary events reach the icon under the finger.
 */
const touchGesture: { startId: string | null; slid: boolean } = {
  startId: null,
  slid: false,
};
let touchListenersInstalled = false;

function suppressNextClick() {
  const cleanup = () => {
    window.removeEventListener("click", swallow, true);
    window.removeEventListener("pointerdown", cleanup, true);
  };
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    cleanup();
  };
  window.addEventListener("click", swallow, true);
  // A new tap must never be swallowed if the browser skipped the click.
  window.addEventListener("pointerdown", cleanup, true);
  window.setTimeout(cleanup, 400);
}

/** Tailwind horizontal-scroll containers; icons inside keep native panning. */
const HORIZONTAL_SCROLLER_SELECTOR = ".overflow-x-auto, .overflow-x-scroll";

function installTouchListeners() {
  if (touchListenersInstalled) return;
  touchListenersInstalled = true;
  document.addEventListener(
    "pointerup",
    (event) => {
      if (event.pointerType !== "touch" || touchGesture.startId == null) return;
      // Lifting on a different icon than the one touched first must not
      // trigger a click on their common ancestor (e.g. a result card).
      if (touchGesture.slid) suppressNextClick();
      touchGesture.startId = null;
      touchGesture.slid = false;
    },
    true
  );
  document.addEventListener(
    "pointercancel",
    (event) => {
      if (event.pointerType !== "touch" || touchGesture.startId == null) return;
      // The browser took over the gesture (scroll); hide the popover.
      touchGesture.startId = null;
      touchGesture.slid = false;
      activePopover?.close();
    },
    true
  );
}

export function AwakeningSpriteIcon({
  awokenSkillId,
  size = PAD_AWAKENING.iconSizePx,
  label,
  title,
  className = "",
}: AwakeningSpriteIconProps) {
  const spriteStyle = awakeningSpriteStyle(awokenSkillId, size);
  const accessibleName = title ?? label ?? `Awakening #${awokenSkillId}`;
  const popoverId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const hovering = useRef(false);
  const focusing = useRef(false);
  const pinned = useRef(false);
  const [open, setOpen] = useState(false);
  // pan-y keeps vertical page scroll but lets a horizontal finger slide reach
  // neighboring icons instead of being taken over as a pan (pointercancel).
  const [touchAction, setTouchAction] = useState<"pan-y" | "auto">("pan-y");

  useLayoutEffect(() => {
    if (anchorRef.current?.closest(HORIZONTAL_SCROLLER_SELECTOR)) {
      setTouchAction("auto");
    }
  }, []);

  function isFromAnchor(event: PointerEvent<HTMLSpanElement>): boolean {
    // React bubbles events from the portaled popover through this anchor.
    return event.target instanceof Node && !!anchorRef.current?.contains(event.target);
  }

  function clearTimer(timer: { current: number | null }) {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function wantsOpen(): boolean {
    return hovering.current || focusing.current || pinned.current;
  }

  function showNow() {
    clearTimer(openTimer);
    clearTimer(closeTimer);
    setOpen(true);
  }

  function scheduleOpen() {
    clearTimer(closeTimer);
    // Moving from one open popover to another icon switches immediately.
    if (activePopover && activePopover.id !== popoverId) {
      showNow();
      return;
    }
    if (openTimer.current != null) return;
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      if (wantsOpen()) setOpen(true);
    }, HOVER_OPEN_MS);
  }

  function scheduleClose() {
    clearTimer(openTimer);
    if (wantsOpen()) return;
    clearTimer(closeTimer);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      if (!wantsOpen()) setOpen(false);
    }, CLOSE_MS);
  }

  function forceClose() {
    clearTimer(openTimer);
    clearTimer(closeTimer);
    hovering.current = false;
    pinned.current = false;
    setOpen(false);
  }

  const forceCloseRef = useRef(forceClose);
  forceCloseRef.current = forceClose;

  useEffect(() => {
    if (!open) return;
    if (activePopover && activePopover.id !== popoverId) {
      activePopover.close();
    }
    const entry = { id: popoverId, close: () => forceCloseRef.current() };
    activePopover = entry;
    return () => {
      if (activePopover === entry) activePopover = null;
    };
  }, [open, popoverId]);

  useEffect(() => {
    return () => {
      clearTimer(openTimer);
      clearTimer(closeTimer);
    };
  }, []);

  useEffect(() => {
    const anchor = anchorRef.current;
    const button = anchor?.closest("button");
    if (!anchor || !button) return;
    if (button.querySelectorAll("[data-awk-icon]").length !== 1) return;

    const onFocus = () => {
      focusing.current = true;
      showNow();
    };
    const onBlur = () => {
      focusing.current = false;
      scheduleClose();
    };
    button.addEventListener("focus", onFocus);
    button.addEventListener("blur", onBlur);
    return () => {
      button.removeEventListener("focus", onFocus);
      button.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") forceClose();
    };
    const onPointerDown = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target)) return;
      const pop = document.getElementById(popoverId);
      if (pop?.contains(target)) return;
      forceClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, popoverId]);

  function onPointerEnter(event: PointerEvent<HTMLSpanElement>) {
    if (!isFromAnchor(event)) return;
    if (event.pointerType === "touch") {
      // Finger slid onto this icon during an ongoing touch.
      if (touchGesture.startId == null) return;
      if (touchGesture.startId !== popoverId) touchGesture.slid = true;
      pinned.current = true;
      showNow();
      return;
    }
    hovering.current = true;
    scheduleOpen();
  }

  function onPointerLeave(event: PointerEvent<HTMLSpanElement>) {
    if (!isFromAnchor(event)) return;
    // Touch keeps the popover until another icon or an outside tap takes over.
    if (event.pointerType === "touch") return;
    hovering.current = false;
    scheduleClose();
  }

  function onPointerDown(event: PointerEvent<HTMLSpanElement>) {
    if (!isFromAnchor(event)) return;
    if (event.pointerType === "touch") {
      installTouchListeners();
      const target = event.target;
      if (target instanceof Element && target.hasPointerCapture(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
      touchGesture.startId = popoverId;
      touchGesture.slid = false;
      pinned.current = true;
    }
    showNow();
  }

  const describedBy = open ? popoverId : undefined;
  const face = spriteStyle ? (
    <span
      role="img"
      aria-label={accessibleName}
      aria-describedby={describedBy}
      className={`inline-block ${frameClass}`}
      style={spriteStyle}
    />
  ) : (
    <img
      src={awakeningFallbackImageUrl}
      alt={accessibleName}
      aria-describedby={describedBy}
      className={`${frameClass} object-cover`}
      style={{ width: size, height: size }}
    />
  );

  return (
    <span
      ref={anchorRef}
      data-awk-icon=""
      className={className}
      style={{ ...anchorStyle, touchAction }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
    >
      {face}
      {open && (
        <AwakeningEffectPopover
          anchorRef={anchorRef}
          awokenSkillId={awokenSkillId}
          popoverId={popoverId}
          fallbackName={accessibleName}
          onPointerEnter={() => {
            hovering.current = true;
            clearTimer(closeTimer);
          }}
          onPointerLeave={() => {
            hovering.current = false;
            scheduleClose();
          }}
        />
      )}
    </span>
  );
}
