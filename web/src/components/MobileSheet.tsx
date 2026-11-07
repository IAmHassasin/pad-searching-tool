import { useEffect, useRef, type ReactNode } from "react";

/**
 * Height of the mobile bottom nav (MobileBottomNav) — every mobile overlay
 * that must clear it (sheets, FABs, launchers) offsets from this value.
 * Tailwind needs the full class literal in source, so the offsets are
 * spelled out rather than computed.
 */
export const MOBILE_NAV_HEIGHT_CLASS = "h-14";
export const MOBILE_NAV_BOTTOM_PADDING_CLASS =
  "pb-[calc(3.5rem+env(safe-area-inset-bottom))]";
export const MOBILE_SHEET_BOTTOM_CLASS =
  "bottom-[calc(3.5rem+env(safe-area-inset-bottom))]";
export const MOBILE_FAB_BOTTOM_CLASS =
  "bottom-[calc(4.25rem+env(safe-area-inset-bottom))]";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  title: ReactNode;
  /** Extra header controls (reset, tab bar…) between the title and ✕. */
  headerExtra?: ReactNode;
  /** Row under the title (e.g. a tab bar). */
  subheader?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export function SheetIconButton({
  onClick,
  label,
  children,
  expanded,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-sm leading-none text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-fg-strong)]"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}

/**
 * Bottom sheet anchored above the mobile bottom nav. Pointer users dismiss
 * via the backdrop; keyboard users via Escape or the ✕ button.
 */
export function MobileSheet({
  open,
  onClose,
  label,
  title,
  headerExtra,
  subheader,
  footer,
  children,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    sheetRef.current?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        aria-hidden
        className="animate-fade-in fixed inset-0 z-[45] bg-black/45"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        role="dialog"
        tabIndex={-1}
        aria-label={label}
        className={`animate-sheet-in fixed inset-x-0 z-50 flex max-h-[min(72dvh,36rem,calc(100dvh-8rem))] min-h-[min(40dvh,calc(100dvh-8rem))] flex-col rounded-t-3xl border-t border-white/10 bg-[var(--color-surface)] shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.7)] outline-none ${MOBILE_SHEET_BOTTOM_CLASS}`}
      >
        <div className="flex shrink-0 justify-center pt-2 pb-1" aria-hidden>
          <span className="h-1.5 w-12 rounded-full bg-slate-600" />
        </div>
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2">
          <h2 className="min-w-0 flex-1 truncate text-base font-bold text-[var(--color-fg-strong)]">
            {title}
          </h2>
          {headerExtra}
          <SheetIconButton onClick={onClose} label="Close sheet">
            ✕
          </SheetIconButton>
        </div>
        {subheader && <div className="shrink-0 px-3 pb-2">{subheader}</div>}
        <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--color-border)]">
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 items-center gap-3 border-t border-white/10 bg-[var(--color-inset)]/80 px-4 py-2.5">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
