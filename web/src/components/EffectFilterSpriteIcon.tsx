import type { CSSProperties } from "react";
import {
  EFFECT_FILTER_TILE_WIDTH,
  effectFilterSpriteStyle,
  getEffectFilterIconRow,
  getEffectFilterStandaloneImage,
} from "../lib/effect-filter-sprite";

export type EffectFilterSpriteIconProps = {
  label: string;
  size?: number;
  title?: string;
  className?: string;
};

const frameClass =
  "shrink-0 rounded-sm border border-[var(--color-border)]/60 bg-[#0d1117]";

export function EffectFilterSpriteIcon({
  label,
  size = EFFECT_FILTER_TILE_WIDTH,
  title,
  className = "",
}: EffectFilterSpriteIconProps) {
  const row = getEffectFilterIconRow(label);
  const standaloneUrl = getEffectFilterStandaloneImage(label);
  if (row === null && standaloneUrl === null) return null;

  const tooltip = title ?? label;

  if (standaloneUrl !== null) {
    return (
      <img
        src={standaloneUrl}
        alt={label}
        title={tooltip}
        className={`${frameClass} object-contain ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const style: CSSProperties = effectFilterSpriteStyle(row!, size);

  return (
    <span
      role="img"
      aria-label={label}
      title={tooltip}
      className={`inline-block ${frameClass} ${className}`}
      style={style}
    />
  );
}
