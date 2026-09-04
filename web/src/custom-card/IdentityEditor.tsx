import type { CustomCardDraft } from "./types";

type Props = {
  draft: CustomCardDraft;
  onChange: (patch: Partial<CustomCardDraft>) => void;
};

export function IdentityEditor({ draft, onChange }: Props) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[#0d1117] p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#c9a84a]">
        Identity
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-[11px] text-[var(--color-muted)]">
          Name
          <input
            type="text"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-sm text-white"
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
            className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-sm text-white"
            placeholder="e.g. 99999"
          />
        </label>
        <label className="block text-[11px] text-[var(--color-muted)] sm:col-span-2">
          Rarity (stars): {draft.rarity}
          <input
            type="range"
            min={0}
            max={10}
            value={draft.rarity}
            onChange={(e) => onChange({ rarity: Number(e.target.value) })}
            className="mt-1 w-full accent-[#c9a84a]"
          />
        </label>
      </div>
    </section>
  );
}
