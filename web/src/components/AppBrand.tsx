import { pstLogoUrl, PST_TITLE } from "../lib/pst-brand";

type Props = {
  title?: string;
  size?: number;
  className?: string;
};

export function AppBrand({
  title = PST_TITLE,
  size = 32,
  className = "",
}: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={pstLogoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full ring-1 ring-[var(--color-accent)]/50 shadow-[var(--shadow-glow)]"
        aria-hidden
      />
      <h1 className="whitespace-nowrap font-mono text-sm font-bold uppercase tracking-wider text-[var(--color-fg-strong)] sm:text-base">
        {title}
      </h1>
    </div>
  );
}
