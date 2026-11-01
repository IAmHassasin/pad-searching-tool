export function SupplementFilterCheckbox({
  label,
  checked,
  onChange,
  compact = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  compact?: boolean;
}) {
  return (
    <label
      className={`mb-1.5 flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-gold)]/25 bg-[var(--color-amber-bg)] px-2 py-1 transition-colors hover:border-[var(--color-gold)]/50 ${
        compact ? "text-[9px]" : "text-[10px]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--color-gold)]"
      />
      <span className="font-medium text-[var(--color-amber-text)]">{label}</span>
    </label>
  );
}
