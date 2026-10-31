import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { loadAwokenSkillBlurbs } from "../lib/awoken-skill-catalog";
import {
  resolveAwokenSkillBlurb,
  type AwokenSkillBlurb,
} from "../lib/awoken-skill-blurbs";

const POPOVER_MARGIN = 8;
const POPOVER_GAP = 6;

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; blurb: AwokenSkillBlurb | null };

function useAwokenSkillBlurb(awokenSkillId: number): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadAwokenSkillBlurbs()
      .then((byId) => {
        if (cancelled) return;
        setState({
          status: "ready",
          blurb: resolveAwokenSkillBlurb(
            awokenSkillId,
            byId.get(awokenSkillId) ?? null
          ),
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [awokenSkillId]);

  return state;
}

function placePopover(
  anchor: DOMRect,
  width: number,
  height: number
): { top: number; left: number } {
  let left = anchor.left;
  if (left + width > window.innerWidth - POPOVER_MARGIN) {
    left = window.innerWidth - POPOVER_MARGIN - width;
  }
  left = Math.max(POPOVER_MARGIN, left);

  let top = anchor.bottom + POPOVER_GAP;
  if (top + height > window.innerHeight - POPOVER_MARGIN) {
    const above = anchor.top - POPOVER_GAP - height;
    if (above >= POPOVER_MARGIN) top = above;
  }
  if (top < POPOVER_MARGIN) top = POPOVER_MARGIN;

  return { top, left };
}

type Props = {
  anchorRef: RefObject<HTMLElement | null>;
  awokenSkillId: number;
  popoverId: string;
  fallbackName: string;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
};

export function AwakeningEffectPopover({
  anchorRef,
  awokenSkillId,
  popoverId,
  fallbackName,
  onPointerEnter,
  onPointerLeave,
}: Props) {
  const popRef = useRef<HTMLDivElement>(null);
  const load = useAwokenSkillBlurb(awokenSkillId);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const pop = popRef.current;
    const anchor = anchorRef.current;
    if (!pop || !anchor) return;

    const update = () => {
      const next = placePopover(
        anchor.getBoundingClientRect(),
        pop.offsetWidth,
        pop.offsetHeight
      );
      setPos(next);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, load]);

  const blurb =
    load.status === "ready"
      ? resolveAwokenSkillBlurb(awokenSkillId, load.blurb)
      : null;
  const name = blurb?.name || fallbackName;
  const description = blurb?.description ?? "";

  return createPortal(
    <div
      ref={popRef}
      id={popoverId}
      role="tooltip"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="ds-float pointer-events-auto fixed z-[80] w-56 rounded-lg px-2.5 py-2"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <p className="text-xs font-semibold leading-snug text-[var(--color-fg-strong)]">
        {name}
      </p>
      {load.status === "loading" && (
        <p className="mt-1 text-[11px] leading-snug text-[var(--color-muted)]">
          Loading description…
        </p>
      )}
      {load.status === "error" && (
        <p className="mt-1 text-[11px] leading-snug text-[var(--color-negative)]">
          Couldn't load awakening descriptions.
        </p>
      )}
      {load.status === "ready" && description && (
        <p className="mt-1 text-[11px] leading-snug whitespace-pre-line text-[var(--color-fg)]">
          {description}
        </p>
      )}
      {load.status === "ready" && !description && (
        <p className="mt-1 text-[11px] leading-snug text-[var(--color-muted)]">
          No description yet.
        </p>
      )}
    </div>,
    document.body
  );
}
