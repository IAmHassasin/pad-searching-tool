import { useState, type ReactNode } from "react";

type Props = {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  compact?: boolean;
  /** When true, section grows to fill remaining panel height (desktop awk grid). */
  fillHeight?: boolean;
  className?: string;
  headerExtra?: ReactNode;
  contentClassName?: string;
  children: ReactNode;
};

export function CollapsibleFilterSection({
  title,
  summary,
  defaultOpen = false,
  compact = false,
  fillHeight = false,
  className,
  headerExtra,
  contentClassName,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={`rounded-lg border border-[var(--color-border)] bg-[#0d1117]/40 ${
        compact ? "p-1.5" : "p-2"
      } ${fillHeight && open ? "flex min-h-0 flex-1 flex-col" : ""} ${className ?? ""}`}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex min-w-0 flex-1 items-center gap-1.5 text-left transition-colors hover:text-white ${
            compact ? "py-0.5" : "py-1"
          }`}
        >
          <span
            className={`shrink-0 text-[var(--color-muted)] transition-transform ${
              open ? "rotate-0" : "-rotate-90"
            } ${compact ? "text-[10px]" : "text-xs"}`}
            aria-hidden
          >
            ▾
          </span>
          <span
            className={`font-semibold text-white ${
              compact ? "text-[11px]" : "text-xs"
            }`}
          >
            {title}
          </span>
          {summary && (
            <span
              className={`ml-auto shrink-0 text-[var(--color-muted)] ${
                compact ? "text-[9px]" : "text-[10px]"
              }`}
            >
              {summary}
            </span>
          )}
        </button>
        {headerExtra}
      </div>
      {open && (
        <div
          className={`mt-2 ${fillHeight ? "flex min-h-0 flex-1 flex-col" : ""} ${contentClassName ?? ""}`}
        >
          {children}
        </div>
      )}
    </section>
  );
}
