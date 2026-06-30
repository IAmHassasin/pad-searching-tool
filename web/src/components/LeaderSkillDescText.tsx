import { useLayoutEffect, useRef, useState } from "react";
import {
  AWOSKILL_TEMPLATE_SPLIT_RE,
  isAwoskillTemplate,
  parseAwoskillTemplateId,
} from "../lib/format-leader-skill-desc";
import { AwakeningSpriteIcon } from "./AwakeningSpriteIcon";

type Props = {
  text: string;
  className?: string;
};

function readLineHeightPx(el: HTMLElement): number | null {
  const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
  return Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : null;
}

export function LeaderSkillDescText({ text, className }: Props) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [iconSize, setIconSize] = useState<number | null>(null);
  const parts = text.split(AWOSKILL_TEMPLATE_SPLIT_RE);
  const hasTemplate = parts.some(isAwoskillTemplate);

  useLayoutEffect(() => {
    if (!hasTemplate) return;
    const el = textRef.current;
    if (!el) return;

    const update = () => {
      const lineHeight = readLineHeightPx(el);
      if (lineHeight != null) setIconSize(Math.round(lineHeight));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasTemplate, text, className]);

  if (!hasTemplate) {
    return <p className={className}>{text}</p>;
  }

  return (
    <p ref={textRef} className={className}>
      {parts.map((part, i) => {
        if (!isAwoskillTemplate(part)) {
          return <span key={i}>{part}</span>;
        }

        const awokenSkillId = parseAwoskillTemplateId(part);
        if (awokenSkillId == null) {
          return <span key={i}>{part}</span>;
        }

        return (
          <AwakeningSpriteIcon
            key={i}
            awokenSkillId={awokenSkillId}
            size={iconSize ?? undefined}
            className="mx-0.5 inline-block align-middle"
          />
        );
      })}
    </p>
  );
}
