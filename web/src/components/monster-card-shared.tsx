export function StarRow({
  count,
  className = "",
}: {
  count: number;
  className?: string;
}) {
  if (!count) return null;
  return (
    <div
      className={`flex gap-px ${className}`}
      aria-label={`${count} star rarity`}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="text-[11px] text-[#ffd54f] drop-shadow-[0_0_2px_#b8860b]"
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function StatRow({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | null | undefined;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline gap-1.5 leading-none ${compact ? "text-[10px]" : "text-[11px]"}`}
    >
      <span className={`font-bold text-[#f0d9b5] ${compact ? "w-6" : "w-7"}`}>
        {label}
      </span>
      <span className="font-bold tabular-nums text-white">
        {value?.toLocaleString() ?? "—"}
      </span>
    </div>
  );
}

export function formatActiveSkillCooldown(
  min: number | null | undefined,
  max: number | null | undefined
): string | null {
  const lo = min ?? max;
  const hi = max ?? min;
  if (lo == null || hi == null || lo <= 0) return null;
  if (lo === hi) return `${lo}`;
  return `${lo}–${hi}`;
}
