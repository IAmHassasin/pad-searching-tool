import { awakeningFallbackImageUrl } from "../lib/awakening-sprite";
import { PAD_AWAKENING } from "../lib/pad-constants";
import { AwakeningSpriteIcon } from "./AwakeningSpriteIcon";

const prefixFrameClass =
  "shrink-0 rounded-sm border border-[#6b8f3c]/80 bg-[#2a3d18] object-cover shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]";

type Props = {
  ids: number[];
  size?: number;
  className?: string;
  /** When true, omit outer flex wrapper (parent group supplies layout). */
  bare?: boolean;
  /** Tooltip / a11y for the 0.png prefix icon. */
  prefixTitle?: string;
  /** Tooltip / a11y per awakening icon. */
  iconTitle?: (id: number) => string;
};

/** 0.png prefix + super/sync icons in a row (right-to-left before the prefix). */
export function SuperAwakeningStrip({
  ids,
  size = PAD_AWAKENING.iconSizePx,
  className = "",
  bare = false,
  prefixTitle = "Super awakening",
  iconTitle = (id) => `Super awakening #${id}`,
}: Props) {
  if (!ids.length) return null;

  const icons = (
    <>
      {[...ids].reverse().map((id, index) => (
        <AwakeningSpriteIcon
          key={`${id}-${index}`}
          awokenSkillId={id}
          size={size}
          title={iconTitle(id)}
        />
      ))}
      <img
        src={awakeningFallbackImageUrl}
        alt=""
        title={prefixTitle}
        className={prefixFrameClass}
        style={{ width: size, height: size }}
      />
    </>
  );

  if (bare) return icons;

  return (
    <div
      className={`flex shrink-0 flex-row items-center ${className}`}
      style={{ gap: PAD_AWAKENING.iconGapPx }}
      aria-label={`${prefixTitle}: ${ids.join(", ")}`}
    >
      {icons}
    </div>
  );
}
