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
        className="shrink-0 rounded-lg shadow-sm"
        aria-hidden
      />
      <h1 className="text-base font-semibold">{title}</h1>
    </div>
  );
}
