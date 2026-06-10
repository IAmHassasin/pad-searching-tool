import { PAD_AWAKENING } from "../lib/pad-constants";
import { AwakeningSpriteIcon } from "./AwakeningSpriteIcon";

export type AwakeningIconListProps = {
  ids: number[];
  size?: number;
  layout?: "column" | "row" | "wrap";
  className?: string;
  /** Optional map awoken_skill_id → display name (tooltip / a11y). */
  labels?: Record<number, string>;
  getLabel?: (awokenSkillId: number) => string | undefined;
};

const layoutClass: Record<NonNullable<AwakeningIconListProps["layout"]>, string> =
  {
    column: "flex flex-col items-center",
    row: "flex flex-row flex-wrap items-center gap-0.5",
    wrap: "flex flex-wrap items-center gap-0.5",
  };

export function AwakeningIconList({
  ids,
  size = PAD_AWAKENING.iconSizePx,
  layout = "column",
  className = "",
  labels,
  getLabel,
}: AwakeningIconListProps) {
  if (!ids.length) return null;

  const resolveLabel = (id: number) => getLabel?.(id) ?? labels?.[id];

  const gapStyle =
    layout === "column" ? { gap: PAD_AWAKENING.iconGapPx } : undefined;

  return (
    <div
      className={`${layoutClass[layout]} ${className}`}
      style={gapStyle}
    >
      {ids.map((id, index) => (
        <AwakeningSpriteIcon
          key={`${id}-${index}`}
          awokenSkillId={id}
          size={size}
          label={resolveLabel(id)}
          title={resolveLabel(id)}
        />
      ))}
    </div>
  );
}
