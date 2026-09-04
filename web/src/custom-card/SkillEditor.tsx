import type { CustomCardDraft } from "./types";

type Props = {
  draft: CustomCardDraft;
  onChange: (patch: Partial<CustomCardDraft>) => void;
};

export function SkillEditor({ draft, onChange }: Props) {
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
            className="mb-1 w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-sm text-white"
          />
          <textarea
            value={draft.activeSkillDesc}
            onChange={(e) => onChange({ activeSkillDesc: e.target.value })}
            placeholder="Skill description"
            rows={3}
            className="mb-1 w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-xs text-white"
          />
          <div className="flex gap-2">
            <label className="flex-1 text-[10px] text-[var(--color-muted)]">
              CD min
              <input
                type="number"
                value={draft.activeSkillCdMin ?? ""}
                onChange={(e) =>
                  onChange({
                    activeSkillCdMin:
                      e.target.value === ""
                        ? null
                        : Number.parseInt(e.target.value, 10) || null,
                  })
                }
                className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-sm text-white"
              />
            </label>
            <label className="flex-1 text-[10px] text-[var(--color-muted)]">
              CD max
              <input
                type="number"
                value={draft.activeSkillCdMax ?? ""}
                onChange={(e) =>
                  onChange({
                    activeSkillCdMax:
                      e.target.value === ""
                        ? null
                        : Number.parseInt(e.target.value, 10) || null,
                  })
                }
                className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-sm text-white"
              />
            </label>
          </div>
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
