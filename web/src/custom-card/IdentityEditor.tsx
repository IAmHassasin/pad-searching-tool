import type { CustomCardDraft } from "./types";

type Props = {
  draft: CustomCardDraft;
  onChange: (patch: Partial<CustomCardDraft>) => void;
};

export function IdentityEditor({ draft, onChange }: Props) {
  return (
    <section className="ds-card p-3">
      <h2 className="ds-label mb-2">Identity</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-[11px] text-[var(--color-muted)]">
          Name
          <input
            type="text"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="ds-input mt-0.5 min-h-9 w-full px-2.5 py-1 text-sm"
            placeholder="Monster name"
          />
        </label>
        <label className="block text-[11px] text-[var(--color-muted)]">
          Number
          <input
            type="number"
            value={draft.number ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                number: v === "" ? null : Number.parseInt(v, 10) || null,
              });
            }}
            className="ds-input mt-0.5 min-h-9 w-full px-2.5 py-1 font-mono text-sm tabular-nums"
            placeholder="e.g. 99999"
          />
        </label>
        <label className="block text-[11px] text-[var(--color-muted)] sm:col-span-2">
          Rarity (stars):{" "}
          <span className="font-mono font-bold text-[var(--color-accent-strong)] tabular-nums">
            {draft.rarity}
          </span>
          <input
            type="range"
            min={0}
            max={10}
            value={draft.rarity}
            onChange={(e) => onChange({ rarity: Number(e.target.value) })}
            className="mt-1 w-full accent-[var(--color-accent)]"
          />
        </label>
      </div>
    </section>
  );
}
