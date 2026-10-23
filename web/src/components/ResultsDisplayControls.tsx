import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
    <label
      className={`-mx-1 flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-1 text-[11px] transition-colors hover:bg-white/5 ${
        checked ? "text-[var(--color-fg-strong)]" : "text-[var(--color-muted)]"
      }`}
    >
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

type MenuPosition = { top: number; left: number };

function placeDisplayMenu(
  button: HTMLButtonElement,
  menu: HTMLElement | null
): MenuPosition {
  const rect = button.getBoundingClientRect();
  const width = menu?.offsetWidth || 176;
  const height = menu?.offsetHeight || 220;
  let left = rect.right - width;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - height - 6);
  }
  return { top, left };
}

export function ResultsDisplayControls({
  sections,
  onSectionsChange,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const allEnabled = isAllSectionsEnabled(sections);
  const activeCount =
    Number(sections.awk) +
    Number(sections.activeSkill) +
    Number(sections.leaderSkill) +
    Number(sections.fullArt);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonRef.current;
      if (!button) return;
      setMenuPos(placeDisplayMenu(button, menuRef.current));
    };
    place();
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, compact]);

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            role="group"
            aria-label="Display"
            className="ds-float animate-fade-in fixed z-[80] max-h-[70vh] min-w-[10.5rem] overflow-y-auto rounded-xl p-2"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <p className="ds-label mb-1.5">Display</p>
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
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        title="Display"
        aria-label={`Display sections${activeCount > 0 ? ` (${activeCount} on)` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next && buttonRef.current) {
              setMenuPos(placeDisplayMenu(buttonRef.current, null));
            }
            return next;
          });
        }}
        className={`pressable rounded-lg border p-1.5 ${
          activeCount > 0
            ? "border-[var(--color-accent)]/60 bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)] shadow-[var(--shadow-glow)]"
            : "border-[var(--color-border)] bg-[var(--color-inset)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-strong)]"
        }`}
      >
        <EyeIcon className="h-3.5 w-3.5" />
        {!compact && <span className="sr-only">Display</span>}
      </button>
      {menu}
    </div>
  );
}

export { DEFAULT_RESULT_DISPLAY_SECTIONS };
