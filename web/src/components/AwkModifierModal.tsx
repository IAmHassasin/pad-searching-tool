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
      className={`rounded-sm border p-px transition-colors ${
        on
          ? "border-[var(--color-accent)] bg-[#1f3a5f]"
          : "border-[#6b8f3c]/40 bg-[#1a2a12]/50 opacity-75 hover:opacity-100"
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
      className={`rounded border px-1 py-px text-[9px] leading-tight ${
        active
          ? "border-[var(--color-accent)] bg-[#1f3a5f] text-white"
          : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[#21262d]"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded border border-[var(--color-border)] bg-[#161b22] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-2 py-1.5">
          <h2 className="text-xs font-semibold text-white">
            Awk modifier — {stat.toUpperCase()}
          </h2>
          <span className="text-[9px] text-[var(--color-muted)]">
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
                className="rounded border border-[var(--color-border)] px-1.5 py-px text-[9px] text-[var(--color-muted)] hover:bg-[#21262d]"
              >
                {allKillersOn ? "−Kill" : "+Kill"}
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_AWK_MODIFIER_SETTINGS })}
              className="rounded border border-[var(--color-border)] px-1.5 py-px text-[9px] text-[var(--color-muted)] hover:bg-[#21262d]"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[var(--color-border)] px-1.5 py-px text-[9px] text-[var(--color-muted)] hover:bg-[#21262d]"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
          <div className="flex flex-wrap gap-0.5">
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
            <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-[var(--color-border)]/60 pt-1.5">
              {showAging && (
                <>
                  <span className="text-[9px] text-[var(--color-muted)]">#130</span>
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
                  <span className="text-[9px] text-[var(--color-muted)]">#131</span>
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
                  <span className="text-[9px] tabular-nums text-white">
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
                  <span className="text-[9px] text-[var(--color-muted)]">#107</span>
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
                  <span className="text-[9px] text-[var(--color-muted)]">#143</span>
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
