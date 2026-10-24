import type { ResultIdScope } from "../lib/result-id-scope";

type Props = {
  value: ResultIdScope;
  onChange: (next: ResultIdScope) => void;
  compact?: boolean;
};

const OPTIONS: { id: ResultIdScope; label: string; title: string }[] = [
  {
    id: "all",
    label: "JP+NA",
    title: "Include JP-only cards. Newest sort uses JP ID when there is no NA ID.",
  },
  {
    id: "na",
    label: "NA",
    title: "NA IDs only. Cards without an NA ID are hidden.",
  },
];

export function ResultIdScopeSwitcher({
  value,
  onChange,
  compact = false,
}: Props) {
  return (
    <div
      role="group"
      aria-label="ID region"
      className="flex shrink-0 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-inset)] p-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            title={opt.title}
            onClick={() => onChange(opt.id)}
            className={`pressable rounded px-1.5 font-semibold tracking-wide ${
              compact ? "py-0.5 text-[9px]" : "py-0.5 text-[10px]"
            } ${
              active
                ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)] shadow-[var(--shadow-glow)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-fg-strong)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
