import { awakeningFallbackImageUrl, getOrbSpriteDef, orbSpriteStyle } from "../lib/orb-sprite";

export type OrbSpriteIconProps = {
  orbId: number;
  size?: number;
  title?: string;
  className?: string;
};

export function OrbSpriteIcon({
  orbId,
  size,
  title,
  className = "",
}: OrbSpriteIconProps) {
  const def = getOrbSpriteDef(orbId);
  const spriteStyle = orbSpriteStyle(orbId, size);
  const tooltip = title ?? def?.label ?? `Orb #${orbId}`;

  if (!spriteStyle) {
    return (
      <img
        src={awakeningFallbackImageUrl}
        alt=""
        title={tooltip}
        className={`inline-block object-cover ${className}`}
        style={{ width: size ?? 20, height: size ?? 20 }}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={tooltip}
      title={tooltip}
      className={`inline-block shrink-0 ${className}`}
      style={spriteStyle}
    />
  );
}
