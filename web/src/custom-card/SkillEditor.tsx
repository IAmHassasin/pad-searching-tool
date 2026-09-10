import { useMemo, useRef, useState, type ReactNode } from "react";
import { AwakeningSpriteIcon } from "../components/AwakeningSpriteIcon";
import { MonsterTypeSpriteIcon } from "../components/MonsterTypeSpriteIcon";
import { OrbSpriteIcon } from "../components/OrbSpriteIcon";
import { SkillEffectSpriteIcon } from "../components/SkillEffectSpriteIcon";
import { AWAKENING_FILTER_GROUPS } from "../lib/awakening-filter-groups";
import {
  formatAwoskillToken,
  formatMonsterTypeToken,
  formatOrbToken,
  formatSkillEffectToken,
} from "../lib/format-leader-skill-desc";
import {
  MATERIAL_MONSTER_TYPE_IDS,
  MONSTER_TYPES,
  monsterTypeLabel,
} from "../lib/monster-types";
import {
  getOrbSpriteDef,
  ORB_PICKER_GROUPS,
  orbSearchText,
} from "../lib/orb-sprite";
import { SKILL_EFFECT_PICKER_GROUPS } from "../lib/skill-effect-sprite";
import type {
  CustomActiveSkillStage,
  CustomActiveSkillType,
  CustomCardDraft,
} from "./types";
import { emptyActiveSkillStage } from "./types";

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

function haystackMatches(query: string, parts: string[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts.some((p) => p.toLowerCase().includes(q));
}

function CollapsiblePickerSection({
  title,
  defaultOpen = true,
  forcedOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  forcedOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const show = forcedOpen || open;
  return (
    <section className="rounded border border-[var(--color-border)] bg-[#0d1117]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={show}
        className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-white/5"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#a8c878]">
          {title}
        </span>
        <span className="text-[10px] text-[var(--color-muted)]" aria-hidden>
          {show ? "▾" : "▸"}
        </span>
      </button>
      {show && (
        <div className="space-y-3 border-t border-[var(--color-border)] px-2 py-2">
          {children}
        </div>
      )}
    </section>
  );
}

function TypeInsertRow({
  onPickType,
  visibleIds,
}: {
  onPickType: (id: number) => void;
  visibleIds?: Set<number>;
}) {
  const types = SKILL_INSERT_TYPES.filter(
    (t) => !visibleIds || visibleIds.has(t.id)
  );
  if (!types.length) return null;
  return (
    <div className="flex flex-wrap gap-0.5">
      {types.map((t) => (
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
  );
}

function AwakeningGroupRows({
  rows,
  onPickAwk,
  visibleIds,
}: {
  rows: number[][];
  onPickAwk: (id: number) => void;
  visibleIds?: Set<number>;
}) {
  const filtered = rows
    .map((row) => (visibleIds ? row.filter((id) => visibleIds.has(id)) : row))
    .filter((row) => row.length > 0);
  if (!filtered.length) return null;
  return (
    <div className="space-y-1">
      {filtered.map((row, rowIndex) => (
        <div key={rowIndex} className="flex flex-wrap gap-0.5">
          {row.map((id) => (
            <button
              key={`${rowIndex}-${id}`}
              type="button"
              title={`Insert awakening #${id}`}
              onClick={() => onPickAwk(id)}
              className="rounded border border-transparent p-0.5 hover:border-[#c9a84a]"
            >
              <AwakeningSpriteIcon awokenSkillId={id} size={20} />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function EffectInsertRow({
  groupLabel,
  ids,
  onPickEffect,
}: {
  groupLabel: string;
  ids: number[];
  onPickEffect: (id: number) => void;
}) {
  if (!ids.length) return null;
  return (
    <div className="flex flex-wrap gap-0.5">
      {ids.map((id) => (
        <button
          key={`${groupLabel}-${id}`}
          type="button"
          title={`Insert effect #${id}`}
          onClick={() => onPickEffect(id)}
          className="rounded border border-transparent p-0.5 hover:border-[#c9a84a]"
        >
          <SkillEffectSpriteIcon effectId={id} size={22} />
        </button>
      ))}
    </div>
  );
}

function OrbInsertRow({
  ids,
  onPickOrb,
}: {
  ids: number[];
  onPickOrb: (id: number) => void;
}) {
  if (!ids.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const def = getOrbSpriteDef(id);
        return (
          <button
            key={id}
            type="button"
            title={def ? `Insert ${def.label}` : `Insert orb #${id}`}
            onClick={() => onPickOrb(id)}
            className="flex w-11 flex-col items-center gap-0.5 rounded border border-transparent p-0.5 hover:border-[#c9a84a]"
          >
            <OrbSpriteIcon orbId={id} size={22} title={def?.label} />
            <span className="max-w-full truncate text-[8px] leading-tight text-[var(--color-muted)]">
              {def?.label ?? id}
            </span>
          </button>
        );
      })}
    </div>
  );
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
    setPickerOpen(true);
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
          onPickOrb={(id) => {
            const def = getOrbSpriteDef(id);
            insertToken(formatOrbToken(id, def?.label ?? "???"));
          }}
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
  onPickOrb,
  onClose,
}: {
  mode: IconInsertMode;
  onPickType: (id: number) => void;
  onPickEffect: (id: number) => void;
  onPickAwk: (id: number) => void;
  onPickOrb: (id: number) => void;
  onClose: () => void;
}) {
  const isLeader = mode === "leader";
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;

  const visibleOrbsByGroup = useMemo(() => {
    return ORB_PICKER_GROUPS.map((group) => ({
      label: group.label,
      ids: group.ids.filter((id) =>
        haystackMatches(query, [group.label, "orb", "orbs", orbSearchText(id)])
      ),
    })).filter((g) => g.ids.length > 0);
  }, [query]);

  const visibleTypeIds = useMemo(() => {
    const ids = new Set<number>();
    for (const t of SKILL_INSERT_TYPES) {
      if (haystackMatches(query, [t.label, "type", "types"])) ids.add(t.id);
    }
    return ids;
  }, [query]);

  const visibleEffectGroups = useMemo(() => {
    return SKILL_EFFECT_PICKER_GROUPS.map((group) => ({
      label: group.label,
      ids: group.ids.filter((id) =>
        haystackMatches(query, [group.label, "effect", "effects", `#${id}`])
      ),
    })).filter((g) => g.ids.length > 0);
  }, [query]);

  const visibleAwkGroups = useMemo(() => {
    const groups = isLeader
      ? MATCH_STYLE_GROUP
        ? [MATCH_STYLE_GROUP]
        : []
      : AWAKENING_FILTER_GROUPS;
    return groups
      .map((group) => ({
        label: group.label,
        rows: group.rows.map((row) =>
          row.filter((id) =>
            haystackMatches(query, [
              group.label,
              "awakening",
              "awakenings",
              `#${id}`,
            ])
          )
        ),
      }))
      .filter((g) => g.rows.some((row) => row.length > 0));
  }, [isLeader, query]);

  const hasAny =
    visibleOrbsByGroup.length > 0 ||
    visibleTypeIds.size > 0 ||
    (!isLeader && visibleEffectGroups.length > 0) ||
    visibleAwkGroups.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal
      aria-label={
        isLeader
          ? "Insert orb, type, or match-style awakening into leader skill"
          : "Insert orb, type, effect, or awakening into active skill"
      }
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="flex max-h-[min(85vh,42rem)] w-full max-w-xl flex-col rounded-xl border border-[#a8842f] bg-[#1a1410] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-sm font-semibold text-[#f5e6c8]">
          {isLeader ? "Insert icon into leader skill" : "Insert icon into active skill"}
        </h3>
        <p className="mb-2 text-[11px] text-[var(--color-muted)]">
          Click to insert at the cursor. Search orbs, locks, nails, types, or
          awakenings. Picker stays open for sequences like orb changing.
        </p>
        <label className="mb-3 block">
          <span className="sr-only">Search icons</span>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: fire, lock, nail, skyfall, dragon…"
            className="w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1.5 text-xs text-white placeholder:text-[var(--color-muted)]"
          />
        </label>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
          {!hasAny && (
            <p className="px-1 py-4 text-center text-xs text-[var(--color-muted)]">
              No icons match “{query.trim()}”.
            </p>
          )}
          {visibleOrbsByGroup.map((group) => (
            <CollapsiblePickerSection
              key={group.label}
              title={group.label}
              defaultOpen
              forcedOpen={searching}
            >
              <OrbInsertRow ids={group.ids} onPickOrb={onPickOrb} />
            </CollapsiblePickerSection>
          ))}
          {visibleTypeIds.size > 0 && (
            <CollapsiblePickerSection
              title="Types"
              defaultOpen
              forcedOpen={searching}
            >
              <TypeInsertRow
                onPickType={onPickType}
                visibleIds={visibleTypeIds}
              />
            </CollapsiblePickerSection>
          )}
          {!isLeader && visibleEffectGroups.length > 0 && (
            searching ? (
              visibleEffectGroups.map((group) => (
                <CollapsiblePickerSection
                  key={group.label}
                  title={group.label}
                  defaultOpen
                  forcedOpen
                >
                  <EffectInsertRow
                    groupLabel={group.label}
                    ids={group.ids}
                    onPickEffect={onPickEffect}
                  />
                </CollapsiblePickerSection>
              ))
            ) : (
              <CollapsiblePickerSection title="Skill effects" defaultOpen={false}>
                {visibleEffectGroups.map((group) => (
                  <section key={group.label}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#a8c878]">
                      {group.label}
                    </p>
                    <EffectInsertRow
                      groupLabel={group.label}
                      ids={group.ids}
                      onPickEffect={onPickEffect}
                    />
                  </section>
                ))}
              </CollapsiblePickerSection>
            )
          )}
          {visibleAwkGroups.length > 0 && (
            searching ? (
              visibleAwkGroups.map((group) => (
                <CollapsiblePickerSection
                  key={group.label}
                  title={group.label}
                  defaultOpen
                  forcedOpen
                >
                  <AwakeningGroupRows rows={group.rows} onPickAwk={onPickAwk} />
                </CollapsiblePickerSection>
              ))
            ) : (
              <CollapsiblePickerSection
                title={isLeader ? "Match style" : "Awakenings"}
                defaultOpen={isLeader}
              >
                {visibleAwkGroups.map((group) => (
                  <section key={group.label}>
                    {!isLeader && (
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#a8c878]">
                        {group.label}
                      </p>
                    )}
                    <AwakeningGroupRows
                      rows={group.rows}
                      onPickAwk={onPickAwk}
                    />
                  </section>
                ))}
              </CollapsiblePickerSection>
            )
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-white"
          >
            Done
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
    const priorCd = [...draft.activeSkillStages]
      .reverse()
      .find((stage) => stage.cd != null && stage.cd > 0)?.cd;
    onChange({
      activeSkillStages: [
        ...draft.activeSkillStages,
        { ...emptyActiveSkillStage(), cd: priorCd ?? 1 },
      ],
    });
  };

  const setSkillType = (id: CustomActiveSkillType) => {
    if (id === "normal" || id === draft.activeSkillType) {
      onChange({ activeSkillType: id });
      return;
    }
    const overall = draft.activeSkillName.trim();
    const stages = draft.activeSkillStages.map((stage, i) =>
      i === 0 && !(stage.name ?? "").trim() && overall
        ? { ...stage, name: overall }
        : stage
    );
    onChange({ activeSkillType: id, activeSkillStages: stages });
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
          {!staged && (
            <input
              type="text"
              value={draft.activeSkillName}
              onChange={(e) => onChange({ activeSkillName: e.target.value })}
              placeholder="Skill name"
              className="mb-1.5 w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-sm text-white"
            />
          )}

          <div className="mb-1.5 flex rounded-lg border border-[var(--color-border)] bg-[#0d1117] p-0.5">
            {SKILL_TYPES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSkillType(id)}
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
                  "One stage is chosen at random."}{" "}
                Each stage has its own skill name; stage 1 is the card header.
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
                  <input
                    type="text"
                    value={stage.name ?? ""}
                    onChange={(e) =>
                      updateStage(index, { name: e.target.value })
                    }
                    placeholder={`Stage ${index + 1} skill name`}
                    className="mb-1 w-full rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1 text-sm text-white"
                  />
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
