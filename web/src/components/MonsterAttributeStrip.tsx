import { monsterAttributeLabel } from "../lib/monster-attributes";
import { PAD_AWAKENING } from "../lib/pad-constants";
import { MonsterAttributeSpriteIcon } from "./MonsterAttributeSpriteIcon";

type Props = {
  attributeIds: number[];
  size?: number;
  className?: string;
  bare?: boolean;
};

/** Monster attribute icons left-to-right (attribute_1, attribute_2, attribute_3). */
export function MonsterAttributeStrip({
  attributeIds,
  size = PAD_AWAKENING.iconSizePx,
  className = "",
  bare = false,
}: Props) {
  if (!attributeIds.length) return null;

  const icons = attributeIds.map((id, index) => (
    <MonsterAttributeSpriteIcon
      key={`${id}-${index}`}
      attributeId={id}
      size={size}
    />
  ));

  if (bare) return icons;

  return (
    <div
      className={`flex shrink-0 flex-row items-center ${className}`}
      style={{ gap: PAD_AWAKENING.iconGapPx }}
      aria-label={`Attributes: ${attributeIds.map(monsterAttributeLabel).join(", ")}`}
    >
      {icons}
    </div>
  );
}
