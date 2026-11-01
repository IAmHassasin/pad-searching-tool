import type { CSSProperties } from "react";
import { AwakeningSpriteIcon } from "../components/AwakeningSpriteIcon";
import { EffectFilterSpriteIcon } from "../components/EffectFilterSpriteIcon";
import { MonsterAttributeSpriteIcon } from "../components/MonsterAttributeSpriteIcon";
import { MonsterPortrait } from "../components/MonsterPortrait";
import { MonsterTypeSpriteIcon } from "../components/MonsterTypeSpriteIcon";
import { OrbSpriteIcon } from "../components/OrbSpriteIcon";
import { SkillEffectSpriteIcon } from "../components/SkillEffectSpriteIcon";
import {
  hexWithOpacity,
  itemBadgeText,
  type TierBadgeStyle,
  type TierItem,
} from "./types";

const OVERLAY_POSITION_CLASS: Record<
  Exclude<TierBadgeStyle["position"], "below">,
  string
> = {
  "bottom-left": "bottom-0 left-0 rounded-tr",
  "bottom-right": "bottom-0 right-0 rounded-tl",
  bottom: "bottom-0 left-0 right-0 text-center",
  "top-left": "top-0 left-0 rounded-br",
  "top-right": "top-0 right-0 rounded-bl",
};

function TierItemIcon({ item, size }: { item: TierItem; size: number }) {
  const n = typeof item.value === "number" ? item.value : Number(item.value);
  switch (item.kind) {
    case "card":
      return (
        <MonsterPortrait
          monsterId={n}
          variant="icon"
          alt={`#${n}`}
          className="block h-full w-full rounded-[3px] bg-black/20 object-cover"
          style={{ width: size, height: size }}
        />
      );
    case "attribute":
      return <MonsterAttributeSpriteIcon attributeId={n} size={size} />;
    case "orb":
      return <OrbSpriteIcon orbId={n} size={size} />;
    case "awakening":
      return <AwakeningSpriteIcon awokenSkillId={n} size={size} />;
    case "skillEffect":
      return <SkillEffectSpriteIcon effectId={n} size={size} />;
    case "filterEffect":
      return <EffectFilterSpriteIcon label={String(item.value)} size={size} />;
    case "type":
      return <MonsterTypeSpriteIcon typeId={n} size={size} />;
    case "text":
      return null;
  }
}

export function TierItemView({
  item,
  size,
  badge,
}: {
  item: TierItem;
  size: number;
  badge: TierBadgeStyle;
}) {
  const badgeCss: CSSProperties = {
    color: badge.textColor,
    backgroundColor: hexWithOpacity(badge.bgColor, badge.bgOpacity),
    fontSize: badge.fontSize,
    fontWeight: badge.bold ? 700 : 400,
  };

  if (item.kind === "text") {
    return (
      <span
        className="inline-flex items-center whitespace-pre-wrap rounded px-1.5 py-0.5 leading-tight"
        style={{ ...badgeCss, minHeight: size * 0.6 }}
      >
        {String(item.value) || " "}
      </span>
    );
  }

  const text = item.showBadge ? itemBadgeText(item) : "";
  const below = text && badge.position === "below";

  return (
    <span
      className="inline-flex flex-col items-center"
      style={below ? { minWidth: size } : { width: size }}
    >
      <span
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <TierItemIcon item={item} size={size} />
        {text && !below && (
          <span
            className={`pointer-events-none absolute max-w-full truncate px-0.5 font-mono leading-none tabular-nums ${
              OVERLAY_POSITION_CLASS[
                badge.position as Exclude<TierBadgeStyle["position"], "below">
              ]
            }`}
            style={{ ...badgeCss, paddingTop: 1, paddingBottom: 1 }}
          >
            {text}
          </span>
        )}
      </span>
      {below && (
        <span
          className="mt-0.5 whitespace-nowrap rounded px-0.5 font-mono leading-none tabular-nums"
          style={{ ...badgeCss, paddingTop: 1, paddingBottom: 1 }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
