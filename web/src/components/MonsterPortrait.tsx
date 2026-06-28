import { useEffect, useState, type CSSProperties } from "react";
import { iconUrl, portraitUrl } from "../lib/portraits";

type Props = {
  monsterId: number;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  /** portrait = full art; icon = small square (media/icons). */
  variant?: "portrait" | "icon";
  onLoad?: () => void;
};

export function MonsterPortrait({
  monsterId,
  alt = "",
  className = "",
  style,
  variant = "portrait",
  onLoad,
}: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [monsterId]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt || "Portrait unavailable"}
        title="Portrait not on CDN"
        className={className}
        style={style}
      />
    );
  }

  return (
    <img
      src={variant === "icon" ? iconUrl(monsterId) : portraitUrl(monsterId)}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      onLoad={onLoad}
      onError={() => setFailed(true)}
    />
  );
}
