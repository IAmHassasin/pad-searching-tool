import { BADGE_POSITIONS, type TierBadgeStyle } from "./types";

export const FIELD_INPUT = "ds-input min-h-8 px-2 py-1 text-xs";

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] text-[var(--color-faint)]">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-[var(--color-border)] bg-transparent p-0.5"
        />
      </span>
    </label>
  );
}

/** Editable highlight style; `value` is the resolved style, `onChange` receives a partial patch. */
export function BadgeStyleFields({
  value,
  onChange,
}: {
  value: TierBadgeStyle;
  onChange: (patch: Partial<TierBadgeStyle>) => void;
}) {
  return (
    <div className="space-y-2">
      <ColorField
        label="Text color"
        value={value.textColor}
        onChange={(textColor) => onChange({ textColor })}
      />
      <ColorField
        label="Background"
        value={value.bgColor}
        onChange={(bgColor) => onChange({ bgColor })}
      />
      <label className="flex items-center justify-between gap-2 text-xs">
        <span className="text-[var(--color-muted)]">BG opacity</span>
        <span className="flex items-center gap-1.5">
          <input
            type="range"
            min={0}
            max={100}
            value={value.bgOpacity}
            onChange={(e) => onChange({ bgOpacity: Number(e.target.value) })}
            className="w-28"
          />
          <span className="w-8 text-right font-mono text-[10px] tabular-nums">
            {value.bgOpacity}%
          </span>
        </span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">Font size</span>
          <input
            type="number"
            min={6}
            max={32}
            value={value.fontSize}
            onChange={(e) =>
              onChange({
                fontSize: Math.min(32, Math.max(6, Number(e.target.value) || 6)),
              })
            }
            className={FIELD_INPUT}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="ds-label">Position</span>
          <select
            value={value.position}
            onChange={(e) =>
              onChange({ position: e.target.value as TierBadgeStyle["position"] })
            }
            className={FIELD_INPUT}
          >
            {BADGE_POSITIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={value.bold}
          onChange={(e) => onChange({ bold: e.target.checked })}
        />
        Bold
      </label>
    </div>
  );
}
