import { APP_TOOLS, currentAppPath, isAppToolActive } from "../lib/app-tools";

type Props = {
  /** `bar` — desktop pill ribbon; `compact` — denser pills for mobile; `inline` — ribbon without bar chrome (PageHeader) */
  variant?: "bar" | "compact" | "inline";
  className?: string;
};

function ToolIcon({
  imageUrl,
  icon,
  size,
}: {
  imageUrl?: string;
  icon?: string;
  size: number;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-full"
        aria-hidden
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`leading-none ${size <= 14 ? "text-xs" : "text-sm"}`}
    >
      {icon}
    </span>
  );
}

export function AppToolsNav({ variant = "bar", className = "" }: Props) {
  const current = currentAppPath();

  // All variants share the segmented pill ribbon; they differ in density and
  // whether the ribbon owns its own bar chrome.
  const compact = variant === "compact";
  const inline = variant === "inline";

  const ribbon = (
    <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {APP_TOOLS.map((tool) => {
        const active = isAppToolActive(tool.href, current);
        return (
          <a
            key={tool.href}
            href={tool.href}
            title={tool.description}
            aria-current={active ? "page" : undefined}
            className={`ds-pill pressable shrink-0 font-semibold ${
              compact
                ? "min-h-9 px-3 text-[11px]"
                : "min-h-9 px-3.5 text-xs"
            } ${active ? "ds-pill-active" : ""}`}
          >
            <ToolIcon
              imageUrl={tool.imageUrl}
              icon={tool.icon}
              size={compact ? 14 : 16}
            />
            <span>{tool.label}</span>
          </a>
        );
      })}
    </div>
  );

  if (inline) {
    return (
      <nav className={className} aria-label="Tools">
        {ribbon}
      </nav>
    );
  }

  return (
    <nav
      className={`shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] ${
        compact ? "px-3 py-2" : "px-4 py-2"
      } ${className}`}
      aria-label="Tools"
    >
      {ribbon}
    </nav>
  );
}
