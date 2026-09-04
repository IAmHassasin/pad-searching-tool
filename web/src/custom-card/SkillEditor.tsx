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

function parseOptionalInt(raw: string): number | null {
  if (raw === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
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
                  <textarea
                    value={stage.body}
                    onChange={(e) =>
                      updateStage(index, { body: e.target.value })
                    }
                    placeholder={`Effect for stage ${index + 1}`}
                    rows={2}
                    className="w-full rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1 text-xs text-white"
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
            <textarea
              value={draft.activeSkillDesc}
              onChange={(e) => onChange({ activeSkillDesc: e.target.value })}
              placeholder="Skill description"
              rows={3}
              className="mb-1 w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-xs text-white"
            />
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
          <textarea
            value={draft.leaderSkillDesc}
            onChange={(e) => onChange({ leaderSkillDesc: e.target.value })}
            placeholder="Leader skill description"
            rows={3}
            className="w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-xs text-white"
          />
        </div>
      </div>
    </section>
  );
}
