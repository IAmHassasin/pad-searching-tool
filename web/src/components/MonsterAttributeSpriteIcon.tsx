import {
  awakeningFallbackImageUrl,
  monsterAttributeSpriteStyle,
} from "../lib/awakening-sprite";
import { monsterAttributeLabel } from "../lib/monster-attributes";
import { PAD_AWAKENING } from "../lib/pad-constants";

export type MonsterAttributeSpriteIconProps = {
  attributeId: number;
  size?: number;
  title?: string;
  className?: string;
};

const frameClass =
  "shrink-0 rounded-sm border border-[#6b8f3c]/80 bg-[#2a3d18] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]";

export function MonsterAttributeSpriteIcon({
  attributeId,
  size = PAD_AWAKENING.iconSizePx,
  title,
  className = "",
}: MonsterAttributeSpriteIconProps) {
  const spriteStyle = monsterAttributeSpriteStyle(attributeId, size);
  const tooltip = title ?? monsterAttributeLabel(attributeId);

  if (!spriteStyle) {
    return (
      <img
        src={awakeningFallbackImageUrl}
        alt=""
        title={tooltip}
        className={`${frameClass} object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={tooltip}
      title={tooltip}
      className={`inline-block ${frameClass} ${className}`}
      style={spriteStyle}
    />
  );
}
