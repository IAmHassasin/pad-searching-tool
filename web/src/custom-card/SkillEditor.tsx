import { useRef, useState } from "react";
import { AwakeningSpriteIcon } from "../components/AwakeningSpriteIcon";
import { MonsterTypeSpriteIcon } from "../components/MonsterTypeSpriteIcon";
import { SkillEffectSpriteIcon } from "../components/SkillEffectSpriteIcon";
import { AWAKENING_FILTER_GROUPS } from "../lib/awakening-filter-groups";
import {
  formatAwoskillToken,
  formatMonsterTypeToken,
  formatSkillEffectToken,
} from "../lib/format-leader-skill-desc";
import {
  MATERIAL_MONSTER_TYPE_IDS,
  MONSTER_TYPES,
  monsterTypeLabel,
} from "../lib/monster-types";
import { SKILL_EFFECT_PICKER_GROUPS } from "../lib/skill-effect-sprite";
import type {
  CustomActiveSkillStage,
  CustomActiveSkillType,
  CustomCardDraft,
} from "./types";

type Props = {
  draft: CustomCardDraft;
  onChange: (patch: Partial<CustomCardDraft>) => void;
};

const SKILL_TYPES: { id: CustomActiveSkillType; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "evo", label: "Evo" },
  { id: "evo-loop", label: "Evo-loop" },
  { id: "random", label: "Random" },
];

/** Playable monster types only (not evo/awoken/enhance mats). */
const SKILL_INSERT_TYPES = MONSTER_TYPES.filter(
  (t) => !MATERIAL_MONSTER_TYPE_IDS.has(t.id)
);

const MATCH_STYLE_GROUP = AWAKENING_FILTER_GROUPS.find(
  (g) => g.label === "Match style"
);

type IconInsertMode = "active" | "leader";

function parseOptionalInt(raw: string): number | null {
  if (raw === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function insertAtCursor(
  value: string,
  token: string,
  el: HTMLTextAreaElement | null
): { next: string; caret: number } {
  if (!el) {
    return { next: `${value}${token}`, caret: value.length + token.length };
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? start;
  const next = value.slice(0, start) + token + value.slice(end);
  return { next, caret: start + token.length };
}

function DescWithAwkInsert({
  value,
  onChange,
  placeholder,
  rows,
  mode,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  rows: number;
  mode: IconInsertMode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const insertToken = (token: string) => {
    const { next, caret } = insertAtCursor(value, token, ref.current);
    onChange(next);
    setPickerOpen(false);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <div>
      <div className="mb-0.5 flex justify-end">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded border border-[#6b8f3c]/70 bg-[#1a2a12] px-1.5 py-0.5 text-[10px] text-[#c5e0a0] hover:border-[#a8c878]"
        >
          Insert icon
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-xs text-white"
      />
      {pickerOpen && (
        <SkillIconInsertPicker
          mode={mode}
          onPickType={(id) => insertToken(formatMonsterTypeToken(id))}
          onPickEffect={(id) => insertToken(formatSkillEffectToken(id))}
          onPickAwk={(id) => insertToken(formatAwoskillToken(id))}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function SkillIconInsertPicker({
  mode,
  onPickType,
  onPickEffect,
  onPickAwk,
  onClose,
}: {
  mode: IconInsertMode;
  onPickType: (id: number) => void;
  onPickEffect: (id: number) => void;
  onPickAwk: (id: number) => void;
  onClose: () => void;
}) {
  const isLeader = mode === "leader";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal
      aria-label={
        isLeader
          ? "Insert type or match-style awakening into leader skill"
          : "Insert type or skill-effect icon into active skill"
      }
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(80vh,32rem)] w-full max-w-lg flex-col rounded-xl border border-[#a8842f] bg-[#1a1410] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-sm font-semibold text-[#f5e6c8]">
          {isLeader ? "Insert type / match icon" : "Insert type / effect icon"}
        </h3>
        <p className="mb-3 text-[11px] text-[var(--color-muted)]">
          {isLeader
            ? "Monster types and Match style awakenings. Renders inline on the card."
            : "Monster types and active-skill effect icons. Renders inline on the card."}
        </p>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
          <section>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#a8c878]">
              Type
            </p>
            <div className="flex flex-wrap gap-0.5">
              {SKILL_INSERT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={`Insert type: ${t.label}`}
                  onClick={() => onPickType(t.id)}
                  className="rounded border border-transparent p-0.5 hover:border-[#c9a84a]"
                >
                  <MonsterTypeSpriteIcon
                    typeId={t.id}
                    size={20}
                    title={monsterTypeLabel(t.id)}
                  />
                </button>
              ))}
            </div>
          </section>
          {isLeader
            ? MATCH_STYLE_GROUP && (
                <section>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#a8c878]">
                    Match style
                  </p>
                  <div className="space-y-1">
                    {MATCH_STYLE_GROUP.rows.map((row, rowIndex) => (
                      <div key={rowIndex} className="flex flex-wrap gap-0.5">
                        {row.map((id) => (
                          <button
                            key={`match-${rowIndex}-${id}`}
                            type="button"
                            title={`Insert awakening #${id}`}
                            onClick={() => onPickAwk(id)}
                            className="rounded border border-transparent p-0.5 hover:border-[#c9a84a]"
                          >
                            <AwakeningSpriteIcon
                              awokenSkillId={id}
                              size={20}
                            />
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </section>
              )
            : SKILL_EFFECT_PICKER_GROUPS.map((group) => (
                <section key={group.label}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#a8c878]">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-0.5">
                    {group.ids.map((id) => (
                      <button
                        key={`${group.label}-${id}`}
                        type="button"
                        title={`Insert effect #${id}`}
                        onClick={() => onPickEffect(id)}
                        className="rounded border border-transparent p-0.5 hover:border-[#c9a84a]"
                      >
                        <SkillEffectSpriteIcon effectId={id} size={22} />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function SkillEditor({ draft, onChange }: Props) {
  const staged = draft.activeSkillType !== "normal";

  const updateStage = (
    index: number,
    patch: Partial<CustomActiveSkillStage>
  ) => {
    const next = draft.activeSkillStages.map((stage, i) =>
      i === index ? { ...stage, ...patch } : stage
    );
    onChange({ activeSkillStages: next });
  };

  const addStage = () => {
    onChange({
      activeSkillStages: [
        ...draft.activeSkillStages,
        { body: "", cd: null },
      ],
    });
  };

  const removeStage = (index: number) => {
    if (draft.activeSkillStages.length <= 2) return;
    onChange({
      activeSkillStages: draft.activeSkillStages.filter((_, i) => i !== index),
    });
  };

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[#0d1117] p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#c9a84a]">
        Skills
      </h2>
      <div className="space-y-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase text-[#9ec5ff]">
            Active skill
          </p>
          <input
            type="text"
            value={draft.activeSkillName}
            onChange={(e) => onChange({ activeSkillName: e.target.value })}
            placeholder="Skill name"
            className="mb-1.5 w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-sm text-white"
          />

          <div className="mb-1.5 flex rounded-lg border border-[var(--color-border)] bg-[#0d1117] p-0.5">
            {SKILL_TYPES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ activeSkillType: id })}
                className={`flex-1 rounded-md px-1.5 py-1 text-[10px] font-medium ${
                  draft.activeSkillType === id
                    ? "bg-[#3d6aa8] text-white"
                    : "text-[var(--color-muted)] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {staged ? (
            <div className="mb-1.5 space-y-2">
              <p className="text-[9px] text-[var(--color-muted)]">
                {draft.activeSkillType === "evo" &&
                  "Stages play in order (no loop)."}
                {draft.activeSkillType === "evo-loop" &&
                  "Stages loop back to 1 after the last."}
                {draft.activeSkillType === "random" &&
                  "One stage is chosen at random."}
              </p>
              {draft.activeSkillStages.map((stage, index) => (
                <div
                  key={index}
                  className="rounded border border-[var(--color-border)] bg-[#161b22] p-2"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-[#9ec5ff]">
                      Stage {index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {(draft.activeSkillType === "evo" ||
                        draft.activeSkillType === "evo-loop") && (
                        <label className="flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
                          CD
                          <input
                            type="number"
                            value={stage.cd ?? ""}
                            onChange={(e) =>
                              updateStage(index, {
                                cd: parseOptionalInt(e.target.value),
                              })
                            }
                            className="w-14 rounded border border-[var(--color-border)] bg-[#0d1117] px-1.5 py-0.5 text-sm text-white"
                            placeholder="—"
                          />
                        </label>
                      )}
                      {draft.activeSkillStages.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeStage(index)}
                          className="text-[10px] text-red-300 hover:text-red-200"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <DescWithAwkInsert
                    mode="active"
                    value={stage.body}
                    onChange={(body) => updateStage(index, { body })}
                    placeholder={`Effect for stage ${index + 1}`}
                    rows={2}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addStage}
                className="rounded border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-muted)] hover:border-[#9ec5ff] hover:text-white"
              >
                + Add stage
              </button>
            </div>
          ) : (
            <div className="mb-1">
              <DescWithAwkInsert
                mode="active"
                value={draft.activeSkillDesc}
                onChange={(activeSkillDesc) => onChange({ activeSkillDesc })}
                placeholder="Skill description"
                rows={3}
              />
            </div>
          )}

          <div className="flex gap-2">
            <label className="flex-1 text-[10px] text-[var(--color-muted)]">
              CD min (skilled)
              <input
                type="number"
                value={draft.activeSkillCdMin ?? ""}
                onChange={(e) =>
                  onChange({
                    activeSkillCdMin: parseOptionalInt(e.target.value),
                  })
                }
                className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-sm text-white"
              />
            </label>
            <label className="flex-1 text-[10px] text-[var(--color-muted)]">
              CD max (Lv.1)
              <input
                type="number"
                value={draft.activeSkillCdMax ?? ""}
                onChange={(e) =>
                  onChange({
                    activeSkillCdMax: parseOptionalInt(e.target.value),
                  })
                }
                className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-sm text-white"
              />
            </label>
          </div>
          {staged && (
            <p className="mt-1 text-[9px] text-[var(--color-muted)]">
              Header shows CD min–max; each stage line shows its own CD badge.
            </p>
          )}
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase text-[#f5d4a8]">
            Leader skill
          </p>
          <input
            type="text"
            value={draft.leaderSkillName}
            onChange={(e) => onChange({ leaderSkillName: e.target.value })}
            placeholder="Leader skill name"
            className="mb-1 w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-sm text-white"
          />
          <DescWithAwkInsert
            mode="leader"
            value={draft.leaderSkillDesc}
            onChange={(leaderSkillDesc) => onChange({ leaderSkillDesc })}
            placeholder="Leader skill description"
            rows={3}
          />
        </div>
      </div>
    </section>
  );
}
