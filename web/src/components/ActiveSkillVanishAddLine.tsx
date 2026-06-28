import { AwakeningSpriteIcon } from "./AwakeningSpriteIcon";

/** Awoken icons granted when an assist vanishes (shown below active skill text). */
export function ActiveSkillVanishAddLine({
  ids,
  iconSize = 16,
}: {
  ids: number[];
  iconSize?: number;
}) {
  if (!ids.length) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#a8c878]">
        Add
      </span>
      {ids.map((id, index) => (
        <AwakeningSpriteIcon
          key={`${id}-${index}`}
          awokenSkillId={id}
          size={iconSize}
          title={`Vanish grant #${id}`}
        />
      ))}
    </div>
  );
}
