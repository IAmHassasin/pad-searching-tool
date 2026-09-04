import { useEffect, useState } from "react";
import {
  ATTRIBUTE_FRAME_RADIUS_PCT,
  ATTRIBUTE_FRAME_ROTATION_DEG,
  ATTRIBUTE_FRAME_SRC,
  frameSrcWithClearCenter,
  framedAttributeIds,
} from "../lib/attribute-frames";
import { monsterAttributeLabel } from "../lib/monster-attributes";
import { MonsterPortrait } from "./MonsterPortrait";

type Props = {
  monsterId: number;
  iconSrc?: string | null;
  attributeIds: Array<number | null | undefined>;
  sizePx: number;
  className?: string;
  alt?: string;
};

/**
 * Square monster icon with PAD-style attribute frames.
 * Portrait is inset + clipped to the frame radius so it cannot stick out
 * past the rounded frame; black window is flood-cleared from the center only.
 */
export function FramedMonsterIcon({
  monsterId,
  iconSrc,
  attributeIds,
  sizePx,
  className = "",
  alt = "",
}: Props) {
  const attrs = framedAttributeIds(attributeIds);
  const [frameUrls, setFrameUrls] = useState<Record<number, string>>({});
  const radius = `${ATTRIBUTE_FRAME_RADIUS_PCT}%`;
  // Keep portrait inside the metallic rim (~6% inset on each side).
  const portraitInset = Math.max(2, Math.round(sizePx * 0.06));

  useEffect(() => {
    let cancelled = false;
    const needed = [...new Set(attrs)];
    // Bust cache key when algorithm changes — clear module cache on reload via full page refresh
    void Promise.all(
      needed.map(async (id) => {
        const src = ATTRIBUTE_FRAME_SRC[id];
        if (!src) return [id, ""] as const;
        try {
          return [id, await frameSrcWithClearCenter(src)] as const;
        } catch {
          return [id, src] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<number, string> = {};
      for (const [id, url] of entries) {
        if (url) next[id] = url;
      }
      setFrameUrls(next);
    });
    return () => {
      cancelled = true;
    };
  }, [attrs.join(",")]);

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-[#0a0a0a] ${className}`}
      style={{
        width: sizePx,
        height: sizePx,
        borderRadius: radius,
      }}
      title={
        attrs.length
          ? attrs.map(monsterAttributeLabel).join(" / ")
          : undefined
      }
    >
      <div
        className="absolute overflow-hidden"
        style={{
          top: portraitInset,
          right: portraitInset,
          bottom: portraitInset,
          left: portraitInset,
          borderRadius: `calc(${radius} - ${portraitInset}px)`,
        }}
      >
        <MonsterPortrait
          monsterId={monsterId}
          alt={alt}
          variant="icon"
          src={iconSrc}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      {attrs.map((attrId, slot) => {
        const src = frameUrls[attrId] ?? ATTRIBUTE_FRAME_SRC[attrId];
        if (!src) return null;
        const rotate = ATTRIBUTE_FRAME_ROTATION_DEG[slot] ?? 0;
        return (
          <img
            key={`${attrId}-${slot}`}
            src={src}
            alt=""
            draggable={false}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1] h-full w-full max-w-none select-none"
            style={{
              transform: `rotate(${rotate}deg)`,
              opacity: 1,
            }}
          />
        );
      })}
    </div>
  );
}
