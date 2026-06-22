import {
  awakeningFallbackImageUrl,
  monsterTypeSpriteStyle,
} from "../lib/awakening-sprite";
import { monsterTypeLabel } from "../lib/monster-types";
import { PAD_AWAKENING } from "../lib/pad-constants";

export type MonsterTypeSpriteIconProps = {
  typeId: number;
  size?: number;
  title?: string;
  className?: string;
};

const frameClass =
  "shrink-0 rounded-sm border border-[#6b8f3c]/80 bg-[#2a3d18] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]";

export function MonsterTypeSpriteIcon({
  typeId,
  size = PAD_AWAKENING.iconSizePx,
  title,
  className = "",
}: MonsterTypeSpriteIconProps) {
  const spriteStyle = monsterTypeSpriteStyle(typeId, size);
  const tooltip = title ?? monsterTypeLabel(typeId);

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
