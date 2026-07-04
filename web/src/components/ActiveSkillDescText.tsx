import {
  AFTER_ACTIVATION_SPLIT_RE,
  isAfterActivationMarker,
  isStagedSkillLine,
} from "../lib/format-active-skill-desc";

type Props = {
  text: string;
  className?: string;
  /** Max-level CD per evo-loop stage, aligned with numbered stage lines. */
  stageCooldowns?: number[] | null;
  compact?: boolean;
};

function DescLineContent({ line }: { line: string }) {
  const parts = line.split(AFTER_ACTIVATION_SPLIT_RE);
  const hasMarker = parts.some(isAfterActivationMarker);

  if (!hasMarker) {
    return <span>{line}</span>;
  }

  return (
    <>
      {parts.map((part, i) =>
        isAfterActivationMarker(part) ? (
          <strong key={i} className="font-bold text-[#f5e6c8]">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function StageCdBadge({
  cd,
  compact = false,
}: {
  cd: number;
  compact?: boolean;
}) {
  return (
    <span
      className={`shrink-0 rounded border border-[#5b8fd4]/40 bg-[#1a2a3f]/80 font-bold tabular-nums text-[#9ec5ff] ${
        compact ? "px-1 py-px text-[8px]" : "px-1 py-px text-[9px]"
      }`}
      title="Active skill cooldown for this stage (turns at max level)"
    >
      CD {cd}
    </span>
  );
}

export function ActiveSkillDescText({
  text,
  className,
  stageCooldowns,
  compact = false,
}: Props) {
  const stageCds = stageCooldowns?.length ? stageCooldowns : null;

  if (stageCds) {
    const lines = text.split("\n");
    let stageIdx = 0;

    return (
      <div className={className}>
        {lines.map((line, i) => {
          const isStageLine = isStagedSkillLine(line);
          const cd =
            isStageLine && stageIdx < stageCds.length
              ? stageCds[stageIdx++]
              : null;

          if (cd != null) {
            return (
              <div
                key={i}
                className={`flex items-start justify-between gap-1.5 ${
                  i > 0 ? (compact ? "mt-0.5" : "mt-1") : ""
                }`}
              >
                <span className="min-w-0">
                  <DescLineContent line={line} />
                </span>
                <StageCdBadge cd={cd} compact={compact} />
              </div>
            );
          }

          if (!line && i < lines.length - 1) {
            return <div key={i} className={compact ? "h-0.5" : "h-1"} />;
          }

          return (
            <p key={i} className={i > 0 ? (compact ? "mt-0.5" : "mt-1") : ""}>
              <DescLineContent line={line} />
            </p>
          );
        })}
      </div>
    );
  }

  const parts = text.split(AFTER_ACTIVATION_SPLIT_RE);
  const hasMarker = parts.some(isAfterActivationMarker);

  if (!hasMarker) {
    return <p className={className}>{text}</p>;
  }

  return (
    <p className={className}>
      {parts.map((part, i) =>
        isAfterActivationMarker(part) ? (
          <strong key={i} className="font-bold text-[#f5e6c8]">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}
