import {
  awakeningFallbackImageUrl,
  awakeningSpriteStyle,
} from "../lib/awakening-sprite";
import { PAD_AWAKENING } from "../lib/pad-constants";

export type AwakeningSpriteIconProps = {
  awokenSkillId: number;
  /** Display size in px (square). Defaults to manifest tile width. */
  size?: number;
  label?: string;
  title?: string;
  className?: string;
};

const frameClass =
  "shrink-0 rounded-sm border border-[#6b8f3c]/80 bg-[#2a3d18] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]";

export function AwakeningSpriteIcon({
  awokenSkillId,
  size = PAD_AWAKENING.iconSizePx,
  label,
  title,
  className = "",
}: AwakeningSpriteIconProps) {
  const spriteStyle = awakeningSpriteStyle(awokenSkillId, size);
  const tooltip = title ?? label ?? `Awakening #${awokenSkillId}`;

  if (!spriteStyle) {
    return (
      <img
        src={awakeningFallbackImageUrl}
        alt={label ?? ""}
        title={tooltip}
        className={`${frameClass} object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={label ?? tooltip}
      title={tooltip}
      className={`inline-block ${frameClass} ${className}`}
      style={spriteStyle}
    />
  );
}
