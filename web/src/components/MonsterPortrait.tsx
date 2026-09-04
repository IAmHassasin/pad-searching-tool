import { useEffect, useState, type CSSProperties } from "react";
import { iconUrl, portraitUrl } from "../lib/portraits";

type Props = {
  monsterId: number;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  /** portrait = full art; icon = small square (media/icons). */
  variant?: "portrait" | "icon";
  /** When set, use this URL instead of CDN (e.g. blob: from custom card upload). */
  src?: string | null;
  onLoad?: () => void;
};

export function MonsterPortrait({
  monsterId,
  alt = "",
  className = "",
  style,
  variant = "portrait",
  src: srcOverride,
  onLoad,
}: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [monsterId, srcOverride, variant]);

  const cdnSrc =
    variant === "icon" ? iconUrl(monsterId) : portraitUrl(monsterId);
  const src =
    srcOverride != null && srcOverride !== "" ? srcOverride : cdnSrc;

  if (failed || !src) {
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
      src={src}
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
