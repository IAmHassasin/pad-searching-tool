import { APP_TOOLS, currentAppPath, isAppToolActive } from "../lib/app-tools";

type Props = {
  /** `bar` — full-width strip on main page; `inline` — compact row in sub-page headers */
  variant?: "bar" | "inline";
  className?: string;
};

export function AppToolsNav({ variant = "bar", className = "" }: Props) {
  const current = currentAppPath();

  if (variant === "inline") {
    return (
      <nav
        className={`flex flex-wrap items-center gap-1 ${className}`}
        aria-label="Tools"
      >
        {APP_TOOLS.map((tool) => {
          const active = isAppToolActive(tool.href, current);
          return (
            <a
              key={tool.href}
              href={tool.href}
              title={tool.description}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                active
                  ? "border-amber-500/70 bg-amber-950/40 text-amber-100"
                  : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-white"
              }`}
            >
              <span aria-hidden className="text-sm leading-none">
                {tool.icon}
              </span>
              <span className="font-medium">{tool.label}</span>
            </a>
          );
        })}
      </nav>
    );
  }

  return (
    <section
      className={`shrink-0 border-b border-[var(--color-border)] bg-[#0d1117] px-4 py-2.5 ${className}`}
      aria-label="Tools"
    >
      <div className="flex flex-wrap items-center gap-2">
        {APP_TOOLS.map((tool) => {
          const active = isAppToolActive(tool.href, current);
          return (
            <a
              key={tool.href}
              href={tool.href}
              title={tool.description}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-[4.5rem] flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-colors ${
                active
                  ? "border-amber-500/80 bg-amber-950/50 text-amber-50 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.15)]"
                  : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-white"
              }`}
            >
              <span aria-hidden className="text-xl leading-none">
                {tool.icon}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {tool.label}
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
