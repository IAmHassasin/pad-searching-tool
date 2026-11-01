import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import bidvQrUrl from "../assets/support/bidv-vietqr.jpg";
import paypalQrUrl from "../assets/support/paypal-support-qr.png";
import { useMobileWebview } from "../hooks/useMobileWebview";

const PAYPAL_SUPPORT_URL = "https://www.paypal.com/ncp/payment/LEDV6R3ZLADZ4";
const BIDV_ACCOUNT_NAME = "PHAM DUC KHA";
const BIDV_ACCOUNT_NUMBER = "2152320037";
const BIDV_BRANCH = "BIDV - PGD Hoàng Quốc Việt";

function usePetFollow(nodeRef: RefObject<HTMLElement | null>, paused: boolean) {
  useEffect(() => {
    const node = nodeRef.current;
    if (!node || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lastScroll = new WeakMap<EventTarget, number>();
    let kick = 0;
    let offset = 0;
    let frame = 0;

    const onScroll = (event: Event) => {
      const scroller = event.target;
      if (!(scroller instanceof Element) && scroller !== document) return;
      const top =
        scroller === document
          ? document.documentElement.scrollTop
          : (scroller as Element).scrollTop;
      const previous = lastScroll.get(scroller) ?? top;
      lastScroll.set(scroller, top);
      const delta = top - previous;
      if (delta === 0) return;
      kick = Math.max(-22, Math.min(22, kick + delta * 0.45));
    };

    const tick = (now: number) => {
      kick *= 0.9;
      offset += (kick - offset) * 0.16;
      const bob = Math.sin(now / 720) * 5;
      const sway = Math.sin(now / 980) * 4 + offset * 0.85;
      node.style.transform = `translate3d(0, ${offset * 0.55 + bob}px, 0) rotate(${sway}deg)`;
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll, { capture: true });
      node.style.transform = "";
    };
  }, [nodeRef, paused]);
}

type Point = { x: number; y: number };
const SUPPORT_POS_KEY = "pst.supportButtonPos";
const SUPPORT_ICON_SIZE = 44;

function clampPoint(x: number, y: number, size: number): Point {
  const maxX = Math.max(8, window.innerWidth - size - 8);
  const maxY = Math.max(8, window.innerHeight - size - 8);
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  };
}

function readStoredPos(): Point | null {
  try {
    const raw = localStorage.getItem(SUPPORT_POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Point>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    return clampPoint(parsed.x, parsed.y, SUPPORT_ICON_SIZE);
  } catch {
    return null;
  }
}

export function SupportLaunch() {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState<Point | null>(() =>
    typeof window === "undefined" ? null : readStoredPos()
  );
  const petRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });
  const suppressClick = useRef(false);
  const isMobile = useMobileWebview();
  const onSearch = window.location.pathname.replace(/\/+$/, "") === "";
  usePetFollow(petRef, open || dragging);

  useEffect(() => {
    if (!isMobile) return;
    const clamp = () => {
      setPos((current) =>
        current ? clampPoint(current.x, current.y, SUPPORT_ICON_SIZE) : current
      );
    };
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [isMobile]);

  const bottom =
    isMobile && onSearch
      ? "calc(env(safe-area-inset-bottom) + 5.25rem)"
      : "calc(env(safe-area-inset-bottom) + 1.25rem)";
  const placed = isMobile && pos != null;

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isMobile || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    const move = (ev: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (drag.pointerId !== ev.pointerId) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      setDragging(true);
      setPos(clampPoint(drag.originX + dx, drag.originY + dy, SUPPORT_ICON_SIZE));
    };
    const end = (ev: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (drag.pointerId !== ev.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      drag.pointerId = -1;
      setDragging(false);
      if (!drag.moved) {
        setOpen(true);
        return;
      }
      suppressClick.current = true;
      const next = clampPoint(
        drag.originX + (ev.clientX - drag.startX),
        drag.originY + (ev.clientY - drag.startY),
        SUPPORT_ICON_SIZE
      );
      setPos(next);
      try {
        localStorage.setItem(SUPPORT_POS_KEY, JSON.stringify(next));
      } catch {
        /* position still applies for this visit */
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  return (
    <>
      <div
        className={`pointer-events-none fixed z-40 ${
          placed ? "" : isMobile ? "left-3" : "right-4"
        }`}
        style={placed ? { left: pos.x, top: pos.y } : { bottom }}
      >
        <div ref={petRef} className="pointer-events-auto will-change-transform">
          <button
            type="button"
            aria-label="Support"
            className={`pressable animate-support-pet border border-amber-200/40 bg-[var(--color-accent)] font-bold text-slate-950 ${
              isMobile
                ? "grid h-11 w-11 touch-none place-items-center rounded-full text-lg"
                : "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs"
            } ${dragging ? "cursor-grabbing" : isMobile ? "cursor-grab" : ""}`}
            onPointerDown={onPointerDown}
            onClick={(event) => {
              if (suppressClick.current) {
                suppressClick.current = false;
                event.preventDefault();
                return;
              }
              if (!isMobile) setOpen(true);
            }}
          >
            <span aria-hidden className={isMobile ? "leading-none" : "text-sm leading-none"}>
              ♥
            </span>
            {isMobile ? null : "Support"}
          </button>
        </div>
      </div>
      {open &&
        createPortal(
          <SupportDialog onClose={() => setOpen(false)} />,
          document.body
        )}
    </>
  );
}

function SupportDialog({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(BIDV_ACCOUNT_NUMBER);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-title"
        className="ds-float animate-sheet-in sm:animate-fade-in max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl p-5 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="support-title"
              className="text-sm font-bold uppercase tracking-wider text-[var(--color-accent-strong)]"
            >
              Support
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              This tool is free. A contribution helps keep it online.
            </p>
          </div>
          <button
            type="button"
            className="ds-btn pressable min-h-9 shrink-0 px-3 py-1 text-xs font-semibold"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-inset)] p-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg-strong)]">
              Bank transfer
            </h3>
            <p className="mt-1 text-[11px] leading-snug text-[var(--color-muted)]">
              Scan with a Vietnamese banking app. You choose the amount.
            </p>
            <img
              src={bidvQrUrl}
              alt="BIDV VietQR for PHAM DUC KHA"
              className="mx-auto mt-3 w-full max-w-[240px] rounded-xl bg-white"
            />
            <dl className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-muted)]">Name</dt>
                <dd className="text-right font-semibold text-[var(--color-fg-strong)]">
                  {BIDV_ACCOUNT_NAME}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--color-muted)]">Account</dt>
                <dd className="font-mono font-semibold text-[var(--color-fg-strong)]">
                  {BIDV_ACCOUNT_NUMBER}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-muted)]">Bank</dt>
                <dd className="text-right text-[var(--color-fg)]">{BIDV_BRANCH}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="ds-btn pressable mt-3 w-full px-3 py-1.5 text-xs font-semibold"
              onClick={() => void copyAccount()}
            >
              {copied ? "Account number copied" : "Copy account number"}
            </button>
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-inset)] p-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg-strong)]">
              PayPal
            </h3>
            <p className="mt-1 text-[11px] leading-snug text-[var(--color-muted)]">
              Scan the code or open PayPal and enter any amount in USD.
            </p>
            <img
              src={paypalQrUrl}
              alt="PayPal Support QR code"
              className="mx-auto mt-3 w-full max-w-[220px] rounded-xl bg-white p-2"
            />
            <a
              href={PAYPAL_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ds-btn-primary pressable mt-3 flex min-h-9 w-full items-center justify-center px-3 py-1.5 text-xs"
            >
              Open PayPal
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
