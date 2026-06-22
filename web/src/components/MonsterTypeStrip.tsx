import { monsterTypeLabel } from "../lib/monster-types";
import { PAD_AWAKENING } from "../lib/pad-constants";
import { MonsterTypeSpriteIcon } from "./MonsterTypeSpriteIcon";

type Props = {
  typeIds: number[];
  size?: number;
  className?: string;
  bare?: boolean;
};

/** Monster type icons left-to-right (type_1, type_2, type_3). */
export function MonsterTypeStrip({
  typeIds,
  size = PAD_AWAKENING.iconSizePx,
  className = "",
  bare = false,
}: Props) {
  if (!typeIds.length) return null;

  const icons = typeIds.map((id, index) => (
    <MonsterTypeSpriteIcon key={`${id}-${index}`} typeId={id} size={size} />
  ));

  if (bare) return icons;

  return (
    <div
      className={`flex shrink-0 flex-row items-center ${className}`}
      style={{ gap: PAD_AWAKENING.iconGapPx }}
      aria-label={`Types: ${typeIds.map(monsterTypeLabel).join(", ")}`}
    >
      {icons}
    </div>
  );
}
