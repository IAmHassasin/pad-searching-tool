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
      className={`mb-1.5 flex cursor-pointer items-center gap-1.5 rounded border border-[var(--color-amber-border)]/40 bg-[var(--color-amber-bg)]/50 px-1.5 py-1 ${
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
