import type { ReactNode } from "react";
import { pstLogoUrl } from "../lib/pst-brand";
import { AppToolsNav } from "./AppToolsNav";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional back link rendered above the title row (e.g. "← All dungeons"). */
  back?: { href: string; label: string };
  /** Right-aligned controls in the sticky top bar (admin chip, primary CTA…). */
  actions?: ReactNode;
  /** Extra header content below the tool ribbon (pickers, meta rows…). */
  children?: ReactNode;
  /** Tailwind max-width class used to align header content with the page body. */
  maxWidthClass?: string;
  /** Hide the tool ribbon (e.g. pages that embed it elsewhere). */
  hideToolsNav?: boolean;
};

/**
 * Shared sub-page chrome: sticky 52px glass app bar (PST crest + title +
 * actions), then the scrollable tool pill ribbon, then optional page header
 * content.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  children,
  maxWidthClass = "max-w-6xl",
  hideToolsNav = false,
}: Props) {
  return (
    <>
      <div className="glass-bar sticky top-0 z-40 shrink-0 border-b border-white/[0.08]">
        <div
          className={`mx-auto flex h-[52px] items-center gap-2.5 px-3 sm:px-4 ${maxWidthClass}`}
        >
          <a href="/" className="shrink-0" aria-label="PAD Searching Tool home">
            <img
              src={pstLogoUrl}
              alt=""
              width={32}
              height={32}
              className="rounded-full ring-1 ring-[var(--color-accent)]/50 shadow-[var(--shadow-glow)]"
            />
          </a>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] leading-tight font-bold text-[var(--color-fg-strong)] sm:text-base">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-[11px] leading-tight text-[var(--color-muted)] sm:text-xs">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
          )}
        </div>
      </div>

      {(!hideToolsNav || back || children) && (
        <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className={`mx-auto space-y-2.5 px-3 py-2.5 sm:px-4 ${maxWidthClass}`}>
            {!hideToolsNav && <AppToolsNav variant="inline" />}
            {back && (
              <a
                href={back.href}
                className="pressable inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent-strong)] hover:underline"
              >
                <span aria-hidden>←</span>
                {back.label}
              </a>
            )}
            {children}
          </div>
        </header>
      )}
    </>
  );
}
