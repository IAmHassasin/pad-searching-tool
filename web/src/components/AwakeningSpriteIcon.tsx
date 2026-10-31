import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
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
  className?: string;
};

const frameClass =
  "shrink-0 rounded-sm border border-[#6b8f3c]/80 bg-[#2a3d18] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]";

const HOVER_OPEN_MS = 280;
const CLOSE_MS = 120;
const LONG_PRESS_MS = 450;

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
  const pressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const hovering = useRef(false);
  const focusing = useRef(false);
  const pinned = useRef(false);
  const [open, setOpen] = useState(false);

  function clearTimer(timer: { current: number | null }) {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function wantsOpen(): boolean {
    return hovering.current || focusing.current || pinned.current;
  }

  function scheduleOpen() {
    clearTimer(closeTimer);
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

  function showNow() {
    clearTimer(openTimer);
    clearTimer(closeTimer);
    setOpen(true);
  }

  useEffect(() => {
    return () => {
      clearTimer(openTimer);
      clearTimer(closeTimer);
      clearTimer(pressTimer);
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
      if (event.key === "Escape") {
        pinned.current = false;
        hovering.current = false;
        setOpen(false);
      }
    };
    const onPointerDown = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target)) return;
      const pop = document.getElementById(popoverId);
      if (pop?.contains(target)) return;
      pinned.current = false;
      hovering.current = false;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, popoverId]);

  function onPointerEnter(event: PointerEvent<HTMLSpanElement>) {
    if (event.pointerType === "touch") return;
    hovering.current = true;
    scheduleOpen();
  }

  function onPointerLeave(event: PointerEvent<HTMLSpanElement>) {
    if (event.pointerType === "touch") return;
    hovering.current = false;
    scheduleClose();
  }

  function onPointerDown(event: PointerEvent<HTMLSpanElement>) {
    if (event.pointerType !== "touch") {
      showNow();
      return;
    }
    clearTimer(pressTimer);
    pressOrigin.current = { x: event.clientX, y: event.clientY };
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      pressOrigin.current = null;
      suppressClick.current = true;
      pinned.current = true;
      showNow();
    }, LONG_PRESS_MS);
  }

  function onPointerMove(event: PointerEvent<HTMLSpanElement>) {
    const origin = pressOrigin.current;
    if (!origin || pressTimer.current == null) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) {
      endPress();
    }
  }

  function endPress() {
    clearTimer(pressTimer);
    pressOrigin.current = null;
  }

  function onClick(event: MouseEvent<HTMLSpanElement>) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
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
      className={`inline-block ${className}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onClick={onClick}
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
