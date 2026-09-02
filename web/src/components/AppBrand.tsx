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
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={pstLogoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-lg shadow-[0_0_0_1px_rgba(88,166,255,0.25),0_4px_12px_-4px_rgba(0,0,0,0.6)]"
        aria-hidden
      />
      <h1 className="whitespace-nowrap text-sm font-bold tracking-tight text-white sm:text-base [font-family:var(--font-mono)]">
        {title}
      </h1>
    </div>
  );
}
