import {
  awakeningFallbackImageUrl,
  skillEffectSpriteStyle,
} from "../lib/skill-effect-sprite";

export type SkillEffectSpriteIconProps = {
  effectId: number;
  size?: number;
  title?: string;
  className?: string;
};

const frameClass =
  "shrink-0 rounded-sm border border-[#6b8f3c]/80 bg-[#2a3d18] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]";

export function SkillEffectSpriteIcon({
  effectId,
  size,
  title,
  className = "",
}: SkillEffectSpriteIconProps) {
  const spriteStyle = skillEffectSpriteStyle(effectId, size);
  const tooltip = title ?? `Skill effect #${effectId}`;

  if (!spriteStyle) {
    return (
      <img
        src={awakeningFallbackImageUrl}
        alt=""
        title={tooltip}
        className={`${frameClass} object-cover ${className}`}
        style={{ width: size ?? 20, height: size ?? 20 }}
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
