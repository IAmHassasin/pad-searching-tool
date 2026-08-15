import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_RESULT_DISPLAY_SECTIONS,
  isAllSectionsEnabled,
  setAllDisplaySections,
  type ResultDisplaySections,
} from "../lib/result-display";

type Props = {
  sections: ResultDisplaySections;
  onSectionsChange: (next: ResultDisplaySections) => void;
  compact?: boolean;
};

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M8 2.5c-2.8 0-5.2 1.7-6.3 4.1a.75.75 0 0 0 0 .6C2.8 9.6 5.2 11.3 8 11.3s5.2-1.7 6.3-4.1a.75.75 0 0 0 0-.6C13.2 4.2 10.8 2.5 8 2.5Zm0 7.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Z" />
    </svg>
  );
}

function DisplayCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-white">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-[var(--color-border)]"
      />
      {label}
    </label>
  );
}

export function ResultsDisplayControls({
  sections,
  onSectionsChange,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const allEnabled = isAllSectionsEnabled(sections);
  const activeCount =
    Number(sections.awk) +
    Number(sections.activeSkill) +
    Number(sections.leaderSkill) +
    Number(sections.fullArt);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="Display"
        aria-label={`Display sections${activeCount > 0 ? ` (${activeCount} on)` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`rounded border p-1 transition-colors ${
          activeCount > 0
            ? "border-[var(--color-accent)]/60 bg-[#1f3a5f]/40 text-[var(--color-accent)]"
            : "border-[var(--color-border)] bg-[#0d1117] text-[var(--color-muted)] hover:text-white"
        }`}
      >
        <EyeIcon className="h-3.5 w-3.5" />
        {!compact && <span className="sr-only">Display</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[9.5rem] rounded-md border border-[var(--color-border)] bg-[#161b22] p-2 shadow-lg">
          <p className="mb-1.5 text-[10px] font-semibold text-[var(--color-muted)]">
            Display
          </p>
          <div className="space-y-1">
            <DisplayCheckbox
              label="All"
              checked={allEnabled}
              onChange={(checked) =>
                onSectionsChange(setAllDisplaySections(sections, checked))
              }
            />
            <DisplayCheckbox
              label="Awk"
              checked={sections.awk}
              onChange={(checked) =>
                onSectionsChange({ ...sections, awk: checked })
              }
            />
            <DisplayCheckbox
              label="Active skill"
              checked={sections.activeSkill}
              onChange={(checked) =>
                onSectionsChange({ ...sections, activeSkill: checked })
              }
            />
            <DisplayCheckbox
              label="Leader skill"
              checked={sections.leaderSkill}
              onChange={(checked) =>
                onSectionsChange({ ...sections, leaderSkill: checked })
              }
            />
            {compact && (
              <DisplayCheckbox
                label="Show full art"
                checked={sections.fullArt}
                onChange={(checked) =>
                  onSectionsChange({ ...sections, fullArt: checked })
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { DEFAULT_RESULT_DISPLAY_SECTIONS };
