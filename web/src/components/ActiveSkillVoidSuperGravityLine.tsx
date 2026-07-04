export function formatVoidSuperGravityLine(turns: number): string {
  const unit = turns === 1 ? "turn" : "turns";
  return `Void Super Gravity for ${turns} ${unit}`;
}

/** Supplement line shown below active skill text (Altema 超重力 duration). */
export function ActiveSkillVoidSuperGravityLine({
  turns,
  compact = false,
}: {
  turns: number;
  compact?: boolean;
}) {
  if (!Number.isInteger(turns) || turns <= 0) return null;

  return (
    <p
      className={`mb-1.5 font-medium text-[#c9a84a] ${
        compact ? "text-[9px]" : "text-[10px]"
      }`}
    >
      {formatVoidSuperGravityLine(turns)}
    </p>
  );
}
