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
    <label className="block font-mono text-[11px] font-semibold text-[var(--color-muted)]">
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
        className="ds-input mt-0.5 min-h-9 w-full px-2.5 py-1 font-mono text-sm tabular-nums"
      />
    </label>
  );
}

export function StatsEditor({ draft, onChange }: Props) {
  return (
    <section className="ds-card p-3">
      <h2 className="ds-label mb-2">Stats</h2>
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
        <StatInput
          label="+HP"
          value={draft.plusHp}
          onValue={(plusHp) => onChange({ plusHp })}
        />
        <StatInput
          label="+ATK"
          value={draft.plusAtk}
          onValue={(plusAtk) => onChange({ plusAtk })}
        />
        <StatInput
          label="+RCV"
          value={draft.plusRcv}
          onValue={(plusRcv) => onChange({ plusRcv })}
        />
        <StatInput
          label="Level"
          value={draft.level}
          onValue={(level) => onChange({ level })}
        />
        <StatInput
          label="Max level"
          value={draft.maxLevel}
          onValue={(maxLevel) => onChange({ maxLevel })}
        />
        <StatInput
          label="Cost"
          value={draft.cost}
          onValue={(cost) => onChange({ cost })}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-[var(--color-muted)]">
        Plus bonuses, level and cost are shown on the card only when set.
      </p>
    </section>
  );
}
