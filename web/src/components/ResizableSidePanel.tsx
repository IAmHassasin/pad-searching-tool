import type { ReactNode } from "react";

type DragHandleProps = React.HTMLAttributes<HTMLDivElement> & {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
};

type Props = {
  side: "left" | "right";
  collapsed: boolean;
  width: number;
  dragHandleProps: DragHandleProps;
  /** Vertical label shown on the collapsed rail, e.g. "Monster" / "Skills". */
  collapsedLabel: string;
  onExpandToggle: () => void;
  ariaLabel: string;
  className?: string;
  children: ReactNode;
};

/**
 * Shared collapse-to-rail + drag-to-resize chrome for a desktop side panel.
 * Each panel owns its own header/content; this only supplies the shell.
 */
export function ResizableSidePanel({
  side,
  collapsed,
  width,
  dragHandleProps,
  collapsedLabel,
  onExpandToggle,
  ariaLabel,
  className = "",
  children,
}: Props) {
  const borderSide = side === "left" ? "border-r" : "border-l";

  if (collapsed) {
    return (
      <aside
        className={`flex h-full w-10 shrink-0 flex-col items-center ${borderSide} border-[var(--color-border)] bg-[var(--color-panel)] py-3`}
        aria-label={ariaLabel}
      >
        <button
          type="button"
          onClick={onExpandToggle}
          title={`Expand ${ariaLabel}`}
          aria-label={`Expand ${ariaLabel}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-inset)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-white"
        >
          <span aria-hidden className="text-sm leading-none">
            {side === "left" ? "›" : "‹"}
          </span>
        </button>
        <span className="mt-3 text-[10px] font-semibold tracking-wide text-[var(--color-muted)] [writing-mode:vertical-rl]">
          {collapsedLabel}
        </span>
      </aside>
    );
  }

  const handle = (
    <div
      {...dragHandleProps}
      className="group relative w-1.5 shrink-0 cursor-col-resize touch-none select-none"
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--color-border)] transition-colors group-hover:bg-[var(--color-accent)] group-focus-visible:bg-[var(--color-accent)]" />
      <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2" />
    </div>
  );

  return (
    <div
      className={`flex h-full shrink-0 overflow-hidden ${className}`}
      style={{ width }}
    >
      {side === "right" && handle}
      <aside
        className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-panel)]"
        aria-label={ariaLabel}
      >
        {children}
      </aside>
      {side === "left" && handle}
    </div>
  );
}
