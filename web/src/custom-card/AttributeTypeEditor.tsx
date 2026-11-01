import { MONSTER_ATTRIBUTES } from "../lib/monster-attributes";
import { MONSTER_TYPES } from "../lib/monster-types";
import { MonsterAttributeSpriteIcon } from "../components/MonsterAttributeSpriteIcon";
import type { CustomCardDraft } from "./types";

type Props = {
  draft: CustomCardDraft;
  onChange: (patch: Partial<CustomCardDraft>) => void;
};

const ATTR_KEYS = ["attribute1", "attribute2", "attribute3"] as const;
const TYPE_KEYS = ["type1", "type2", "type3"] as const;

export function AttributeTypeEditor({ draft, onChange }: Props) {
  return (
    <section className="ds-card p-3">
      <h2 className="ds-label mb-2">Attributes &amp; types</h2>
      <p className="mb-1 text-[10px] font-semibold tracking-wide text-slate-300 uppercase">
        Attributes
      </p>
      <div className="mb-3 space-y-2">
        {ATTR_KEYS.map((key, slot) => (
          <div key={key} className="flex flex-wrap items-center gap-1">
            <span className="w-10 font-mono text-[10px] text-[var(--color-faint)] tabular-nums">
              #{slot + 1}
            </span>
            {MONSTER_ATTRIBUTES.filter((a) => a.id !== 5).map((attr) => {
              const active = draft[key] === attr.id;
              const isNone = attr.id === 6;
              return (
                <button
                  key={attr.id}
                  type="button"
                  title={attr.label}
                  onClick={() =>
                    onChange({
                      [key]: active ? null : isNone ? null : attr.id,
                    })
                  }
                  className={`pressable rounded-md border p-1 ${
                    active
                      ? "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)] shadow-[var(--shadow-glow)]"
                      : "border-transparent hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)]"
                  }`}
                >
                  {isNone ? (
                    <span className="flex h-5 w-5 items-center justify-center text-[9px] text-[var(--color-muted)]">
                      —
                    </span>
                  ) : (
                    <MonsterAttributeSpriteIcon attributeId={attr.id} size={20} />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mb-1 text-[10px] font-semibold tracking-wide text-slate-300 uppercase">
        Types
      </p>
      <div className="space-y-2">
        {TYPE_KEYS.map((key, slot) => (
          <label
            key={key}
            className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]"
          >
            <span className="w-10 shrink-0 font-mono text-[10px] text-[var(--color-faint)] tabular-nums">
              #{slot + 1}
            </span>
            <select
              value={draft[key] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onChange({
                  [key]: v === "" ? null : Number.parseInt(v, 10),
                });
              }}
              className="ds-input min-h-9 min-w-0 flex-1 px-2 py-1 text-sm"
            >
              <option value="">None</option>
              {MONSTER_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
