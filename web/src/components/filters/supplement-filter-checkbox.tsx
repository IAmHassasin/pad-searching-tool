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
      className={`mb-1.5 flex cursor-pointer items-center gap-1.5 rounded border border-[#8b6914]/40 bg-[#2a1f14]/50 px-1.5 py-1 ${
        compact ? "text-[9px]" : "text-[10px]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#c9a84a]"
      />
      <span className="font-medium text-[#e8dcc8]">{label}</span>
    </label>
  );
}
