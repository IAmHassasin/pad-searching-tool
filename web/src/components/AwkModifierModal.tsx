import type { ReactNode } from "react";
import { AwakeningSpriteIcon } from "./AwakeningSpriteIcon";
import {
  DEFAULT_AWK_MODIFIER_SETTINGS,
  getModifierAwksForStat,
  KILLER_AWAKENING_IDS,
  withAwkEnabled,
  type AwkModifierSettings,
} from "../lib/awakening-stat-modifier";

type Props = {
  open: boolean;
  stat: "hp" | "atk" | "rcv";
  settings: AwkModifierSettings;
  onChange: (next: AwkModifierSettings) => void;
  onClose: () => void;
};

const EXCLUSIVE_GROUPS: number[][] = [
  [128, 129],
  [138, 139],
  [57, 58],
];

function exclusiveGroupFor(id: number): number[] | undefined {
  return EXCLUSIVE_GROUPS.find((g) => g.includes(id));
}

function isEnabled(settings: AwkModifierSettings, id: number): boolean {
  return settings.enabled.includes(id);
}

function AwkToggle({
  id,
  settings,
  onChange,
}: {
  id: number;
  settings: AwkModifierSettings;
  onChange: (next: AwkModifierSettings) => void;
}) {
  const on = isEnabled(settings, id);
  const group = exclusiveGroupFor(id);

  return (
    <button
      type="button"
      title={`#${id}`}
      aria-pressed={on}
      onClick={() => {
        if (on) {
          onChange(withAwkEnabled(settings, id, false));
          return;
        }
        let next = settings;
        if (group) {
          for (const other of group) {
            if (other !== id && isEnabled(next, other)) {
              next = withAwkEnabled(next, other, false);
            }
          }
        }
        onChange(withAwkEnabled(next, id, true));
      }}
      className={`pressable rounded border p-0.5 ${
        on
          ? "border-[var(--color-secondary)] bg-[var(--color-secondary-muted)] shadow-[var(--shadow-glow-cyan)]"
          : "border-[var(--color-border)] bg-[var(--color-inset)] opacity-60 hover:border-[var(--color-border-strong)] hover:opacity-100"
      }`}
    >
      <AwakeningSpriteIcon awokenSkillId={id} size={18} />
    </button>
  );
}

function MiniBtn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pressable min-w-6 rounded-full border px-1.5 py-0.5 font-mono text-[10px] leading-tight tabular-nums ${
        active
          ? "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)] text-[var(--color-accent-strong)] shadow-[var(--shadow-glow)]"
          : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-strong)]"
      }`}
    >
      {children}
    </button>
  );
}

export function AwkModifierModal({ open, stat, settings, onChange, onClose }: Props) {
  if (!open) return null;

  const modifierAwks = getModifierAwksForStat(stat);
  const showAging = isEnabled(settings, 130);
  const showParts = isEnabled(settings, 131);
  const showCombo = isEnabled(settings, 107);
  const showBattle = isEnabled(settings, 143);
  const hasOptions = showAging || showParts || showCombo || showBattle;

  const visibleKillerIds = KILLER_AWAKENING_IDS.filter((id) =>
    modifierAwks.includes(id)
  );
  const allKillersOn =
    visibleKillerIds.length > 0 &&
    visibleKillerIds.every((id) => isEnabled(settings, id));

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-3"
      onClick={onClose}
    >
      <div
        className="ds-float animate-sheet-in flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl pb-[env(safe-area-inset-bottom)] sm:animate-none sm:rounded-2xl sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-2">
          <h2 className="text-sm font-bold text-[var(--color-fg-strong)]">
            Awk modifier — {stat.toUpperCase()}
          </h2>
          <span className="rounded-full border border-[var(--color-secondary)]/40 bg-[var(--color-secondary-muted)] px-1.5 py-px font-mono text-[9px] font-bold tabular-nums text-[var(--color-secondary-strong)]">
            {settings.enabled.length} sel
          </span>
          <div className="ml-auto flex gap-1">
            {visibleKillerIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  let next = settings;
                  for (const id of visibleKillerIds) {
                    next = withAwkEnabled(next, id, !allKillersOn);
                  }
                  onChange(next);
                }}
                className="ds-btn pressable h-7 px-2 text-[10px] font-semibold"
              >
                {allKillersOn ? "−Kill" : "+Kill"}
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_AWK_MODIFIER_SETTINGS })}
              className="pressable h-7 rounded-lg px-2 text-[10px] font-semibold text-[var(--color-muted)] hover:bg-[var(--color-negative)]/10 hover:text-[var(--color-negative)]"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="pressable flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-sm leading-none text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-fg-strong)]"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {modifierAwks.map((id) => (
              <AwkToggle
                key={id}
                id={id}
                settings={settings}
                onChange={onChange}
              />
            ))}
          </div>

          {hasOptions && (
            <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-white/[0.06] pt-2">
              {showAging && (
                <>
                  <span className="font-mono text-[9px] tabular-nums text-[var(--color-faint)]">#130</span>
                  <MiniBtn
                    active={settings.agingBattle === 5}
                    onClick={() => onChange({ ...settings, agingBattle: 5 })}
                  >
                    B5
                  </MiniBtn>
                  <MiniBtn
                    active={settings.agingBattle === 10}
                    onClick={() => onChange({ ...settings, agingBattle: 10 })}
                  >
                    B10
                  </MiniBtn>
                </>
              )}
              {showParts && (
                <>
                  <span className="font-mono text-[9px] tabular-nums text-[var(--color-faint)]">#131</span>
                  <MiniBtn
                    onClick={() =>
                      onChange({
                        ...settings,
                        parts131: Math.max(0, settings.parts131 - 1),
                      })
                    }
                  >
                    −
                  </MiniBtn>
                  <span className="min-w-4 text-center font-mono text-[10px] font-semibold tabular-nums text-[var(--color-fg-strong)]">
                    {settings.parts131}
                  </span>
                  <MiniBtn
                    onClick={() =>
                      onChange({
                        ...settings,
                        parts131: Math.min(10, settings.parts131 + 1),
                      })
                    }
                  >
                    +
                  </MiniBtn>
                </>
              )}
              {showCombo && (
                <>
                  <span className="font-mono text-[9px] tabular-nums text-[var(--color-faint)]">#107</span>
                  <MiniBtn
                    active={settings.combo43 === 7}
                    onClick={() => onChange({ ...settings, combo43: 7 })}
                  >
                    7c
                  </MiniBtn>
                  <MiniBtn
                    active={settings.combo43 === 14}
                    onClick={() => onChange({ ...settings, combo43: 14 })}
                  >
                    14c
                  </MiniBtn>
                </>
              )}
              {showBattle && (
                <>
                  <span className="font-mono text-[9px] tabular-nums text-[var(--color-faint)]">#143</span>
                  {([3, 6, 9, 12, 15] as const).map((b) => (
                    <MiniBtn
                      key={b}
                      active={settings.battle143 === b}
                      onClick={() => onChange({ ...settings, battle143: b })}
                    >
                      B{b}
                    </MiniBtn>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
