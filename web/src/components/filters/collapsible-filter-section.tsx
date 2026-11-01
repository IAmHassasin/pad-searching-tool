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
      className={`ds-card transition-colors ${
        open ? "border-white/10" : "hover:border-white/10"
      } ${compact ? "p-1.5" : "p-2"} ${fillHeight && open ? "flex min-h-0 flex-1 flex-col" : ""} ${className ?? ""}`}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`group flex min-w-0 flex-1 items-center gap-1.5 rounded-md text-left transition-colors ${
            compact ? "py-0.5" : "py-1"
          }`}
        >
          <span
            className={`shrink-0 transition-transform ${
              open
                ? "rotate-0 text-[var(--color-accent)]"
                : "-rotate-90 text-[var(--color-faint)] group-hover:text-[var(--color-muted)]"
            } ${compact ? "text-[10px]" : "text-xs"}`}
            aria-hidden
          >
            ▾
          </span>
          <span
            className={`ds-label transition-colors group-hover:text-[var(--color-fg-strong)] ${
              open ? "text-[var(--color-fg)]" : ""
            } ${compact ? "text-[10px]" : "text-[11px]"}`}
          >
            {title}
          </span>
          {summary && (
            <span
              className={`ml-auto shrink-0 font-mono tabular-nums text-[var(--color-muted)] ${
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
