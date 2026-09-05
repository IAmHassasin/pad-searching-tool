import { useLayoutEffect, useRef, useState } from "react";
import { isStagedSkillLine } from "../lib/format-active-skill-desc";
import {
  SkillDescRichContent,
  skillDescNeedsRichRender,
} from "./SkillDescRichText";

type Props = {
  text: string;
  className?: string;
  /** Max-level CD per evo-loop stage, aligned with numbered stage lines. */
  stageCooldowns?: number[] | null;
  /**
   * Overall skill CD label (same as header), e.g. "2–6".
   * Stage 1 badge uses this min–max; later stages use stageCooldowns[i].
   */
  skillCdRange?: string | null;
  compact?: boolean;
};

function readLineHeightPx(el: HTMLElement): number | null {
  const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
  return Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : null;
}

function StageCdBadge({
  cd,
  compact = false,
  title,
}: {
  cd: string;
  compact?: boolean;
  title?: string;
}) {
  return (
    <span
      className={`shrink-0 rounded border border-[#5b8fd4]/40 bg-[#1a2a3f]/80 font-bold tabular-nums text-[#9ec5ff] ${
        compact ? "px-1 py-px text-[8px]" : "px-1 py-px text-[9px]"
      }`}
      title={title ?? "Active skill cooldown for this stage"}
    >
      CD {cd}
    </span>
  );
}

export function ActiveSkillDescText({
  text,
  className,
  stageCooldowns,
  skillCdRange = null,
  compact = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [iconSize, setIconSize] = useState<number | null>(null);
  const stageCds = stageCooldowns?.length ? stageCooldowns : null;
  const needsIcons = skillDescNeedsRichRender(text);

  useLayoutEffect(() => {
    if (!needsIcons) return;
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      const lineHeight = readLineHeightPx(el);
      if (lineHeight != null) setIconSize(Math.round(lineHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [needsIcons, text, className, compact]);

  if (stageCds) {
    const lines = text.split("\n");
    let stageIdx = 0;

    return (
      <div ref={rootRef} className={className}>
        {lines.map((line, i) => {
          const isStageLine = isStagedSkillLine(line);
          let cdLabel: string | null = null;
          if (isStageLine) {
            const idx = stageIdx++;
            if (idx === 0 && skillCdRange) {
              cdLabel = skillCdRange;
            } else if (idx < stageCds.length && stageCds[idx] != null) {
              cdLabel = String(stageCds[idx]);
            } else if (idx === 0 && stageCds[0] != null) {
              cdLabel = String(stageCds[0]);
            }
          }

          if (cdLabel != null) {
            return (
              <div
                key={i}
                className={`flex items-start justify-between gap-1.5 ${
                  i > 0 ? (compact ? "mt-0.5" : "mt-1") : ""
                }`}
              >
                <span className="min-w-0">
                  <SkillDescRichContent text={line} iconSize={iconSize} />
                </span>
                <StageCdBadge
                  cd={cdLabel}
                  compact={compact}
                  title={
                    stageIdx === 1 && skillCdRange
                      ? "Stage 1 cooldown (same as overall skill CD min–max)"
                      : "Active skill cooldown for this stage (turns at max level)"
                  }
                />
              </div>
            );
          }

          if (!line && i < lines.length - 1) {
            return <div key={i} className={compact ? "h-0.5" : "h-1"} />;
          }

          return (
            <p key={i} className={i > 0 ? (compact ? "mt-0.5" : "mt-1") : ""}>
              <SkillDescRichContent text={line} iconSize={iconSize} />
            </p>
          );
        })}
      </div>
    );
  }

  if (!needsIcons) {
    return <p className={className}>{text}</p>;
  }

  return (
    <div ref={rootRef} className={className}>
      <SkillDescRichContent text={text} iconSize={iconSize} />
    </div>
  );
}
