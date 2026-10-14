import { AwakeningSpriteIcon } from "../components/AwakeningSpriteIcon";
import type { OneTouchFloor } from "./types";

type Props = {
  dungeonName: string;
  floors: OneTouchFloor[];
  showHiddenGlobal: boolean;
  onToggleHiddenGlobal: () => void;
  expandedHiddenLevels: Set<number>;
  onToggleHiddenLevel: (level: number) => void;
  onAddAwakening: (id: number, nameEn: string) => void;
  onAddFloorAwakenings: (floor: OneTouchFloor) => void;
  className?: string;
};

export function DungeonFloorPanel({
  dungeonName,
  floors,
  showHiddenGlobal,
  onToggleHiddenGlobal,
  expandedHiddenLevels,
  onToggleHiddenLevel,
  onAddAwakening,
  onAddFloorAwakenings,
  className = "",
}: Props) {
  return (
    <section className={`ds-card flex min-h-0 flex-col overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2.5">
        <div>
          <h2 className="text-[13px] font-bold tracking-wider text-slate-300 uppercase">
            {dungeonName} floors
          </h2>
          <p className="text-xs text-[var(--color-muted)]">
            Recommended awakenings per level
          </p>
        </div>
        <label
          className={`pressable flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-semibold ${
            showHiddenGlobal
              ? "border-[var(--color-secondary)]/60 bg-[var(--color-secondary-muted)] text-[var(--color-secondary-strong)]"
              : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-strong)]"
          }`}
        >
          <input
            type="checkbox"
            checked={showHiddenGlobal}
            onChange={onToggleHiddenGlobal}
            className="rounded border-[var(--color-border)]"
          />
          Show hidden rewards
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--color-hover)] text-left">
            <tr>
              <th className="ds-label px-2 py-2">Lv</th>
              <th className="ds-label px-2 py-2">Stamina / time</th>
              <th className="ds-label px-2 py-2">Recommended awk</th>
              <th className="ds-label px-2 py-2">Rewards</th>
              {showHiddenGlobal && (
                <th className="ds-label px-2 py-2">Hidden</th>
              )}
            </tr>
          </thead>
          <tbody>
            {floors.map((floor) => {
              const hiddenOpen =
                showHiddenGlobal && expandedHiddenLevels.has(floor.level);
              return (
                <tr
                  key={floor.level}
                  className="border-t border-[var(--color-border)] align-top transition-colors hover:bg-[var(--color-hover)]"
                >
                  <td className="px-2 py-2 font-mono font-bold whitespace-nowrap text-[var(--color-accent-strong)] tabular-nums">
                    Lv{floor.level}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs whitespace-nowrap text-[var(--color-muted)] tabular-nums">
                    {floor.stamina != null && floor.durationHours != null
                      ? `${floor.stamina} / ${floor.durationHours}h`
                      : "—"}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {floor.recommendedAwakenings.map((a) =>
                        a.id != null ? (
                          <button
                            key={`${floor.level}-${a.id}`}
                            type="button"
                            title={`Queue ${a.nameEn}`}
                            onClick={() => onAddAwakening(a.id!, a.nameEn)}
                            className="pressable rounded hover:ring-1 hover:ring-[var(--color-accent)]"
                          >
                            <AwakeningSpriteIcon
                              awokenSkillId={a.id}
                              size={24}
                              label={a.nameEn}
                            />
                          </button>
                        ) : (
                          <span
                            key={`${floor.level}-${a.nameJa}`}
                            className="rounded border border-[var(--color-border)] px-1 py-0.5 text-[10px] text-[var(--color-muted)]"
                            title={a.nameJa}
                          >
                            {a.nameEn}
                          </span>
                        )
                      )}
                      <button
                        type="button"
                        className="pressable ml-1 rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent-strong)] hover:border-[var(--color-accent)]"
                        onClick={() => onAddFloorAwakenings(floor)}
                      >
                        + all
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {floor.rewards ? (
                      <div className="space-y-0.5 text-[var(--color-muted)] tabular-nums">
                        {floor.rewards.explorationExp != null && (
                          <div>Exp {floor.rewards.explorationExp}</div>
                        )}
                        {floor.rewards.coins && (
                          <div>Coins {floor.rewards.coins}</div>
                        )}
                        {floor.rewards.plusPoints != null && (
                          <div>+{floor.rewards.plusPoints} plus</div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  {showHiddenGlobal && (
                    <td className="px-2 py-2 text-xs">
                      <button
                        type="button"
                        className="text-left font-semibold text-[var(--color-secondary-strong)] hover:underline"
                        onClick={() => onToggleHiddenLevel(floor.level)}
                      >
                        {hiddenOpen ? "Hide" : "Show"}
                      </button>
                      {hiddenOpen && (
                        <div className="mt-1 space-y-1 text-[var(--color-muted)]">
                          <div>
                            <span className="text-[var(--color-muted)]/80">
                              Condition:{" "}
                            </span>
                            {floor.hiddenConditionEn ?? "—"}
                          </div>
                          <div>
                            <span className="text-[var(--color-muted)]/80">
                              Reward:{" "}
                            </span>
                            {floor.hiddenReward}
                          </div>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
