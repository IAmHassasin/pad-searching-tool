import type { CustomCardDraft } from "./types";

type Props = {
  draft: CustomCardDraft;
  onChange: (patch: Partial<CustomCardDraft>) => void;
};

function StatInput({
  label,
  value,
  onValue,
}: {
  label: string;
  value: number | null;
  onValue: (v: number | null) => void;
}) {
  return (
    <label className="block text-[11px] text-[var(--color-muted)]">
      {label}
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) =>
          onValue(
            e.target.value === ""
              ? null
              : Number.parseInt(e.target.value, 10) || null
          )
        }
        className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[#161b22] px-2 py-1 text-sm text-white"
      />
    </label>
  );
}

export function StatsEditor({ draft, onChange }: Props) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[#0d1117] p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#c9a84a]">
        Stats
      </h2>
      <div className="grid grid-cols-3 gap-2">
        <StatInput
          label="HP"
          value={draft.hpMax}
          onValue={(hpMax) => onChange({ hpMax })}
        />
        <StatInput
          label="ATK"
          value={draft.atkMax}
          onValue={(atkMax) => onChange({ atkMax })}
        />
        <StatInput
          label="RCV"
          value={draft.rcvMax}
          onValue={(rcvMax) => onChange({ rcvMax })}
        />
      </div>
    </section>
  );
}
