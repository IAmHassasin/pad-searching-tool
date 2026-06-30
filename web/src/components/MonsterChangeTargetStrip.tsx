import { MonsterPortrait } from "./MonsterPortrait";

const labelClass =
  "rounded border border-[#6b4f2a]/90 bg-[#2f2118]/95 px-1.5 py-0.5 text-[#e8dcc8] shadow-md";

type Props = {
  targetIds: number[];
  onSelectTarget: (monsterId: number) => void;
  loadingId?: number | null;
  iconSize?: number;
};

export function MonsterChangeTargetStrip({
  targetIds,
  onSelectTarget,
  loadingId = null,
  iconSize = 40,
}: Props) {
  if (!targetIds.length) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={labelClass}
        style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.25 }}
      >
        Change
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {targetIds.map((targetId) => {
          const loading = loadingId === targetId;
          return (
            <button
              key={targetId}
              type="button"
              onClick={() => onSelectTarget(targetId)}
              disabled={loading}
              aria-label={`View monster #${targetId}`}
              title={`#${targetId}`}
              className="shrink-0 rounded border border-[#8b6914]/70 bg-[#1a1410] p-0.5 transition-shadow hover:border-[#c9a84a] hover:shadow-md disabled:opacity-60"
              style={{ width: iconSize, height: iconSize }}
            >
              <MonsterPortrait
                monsterId={targetId}
                alt=""
                variant="icon"
                className="h-full w-full rounded object-cover"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
