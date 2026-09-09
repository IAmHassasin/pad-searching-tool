import { useLayoutEffect, useRef, useState } from "react";
import {
  SkillDescRichContent,
  skillDescNeedsRichRender,
} from "./SkillDescRichText";

type Props = {
  text: string;
  className?: string;
};

function readLineHeightPx(el: HTMLElement): number | null {
  const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
  return Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : null;
}

function capInlineIconSize(lineHeightPx: number): number {
  return Math.min(14, Math.max(7, Math.round(lineHeightPx * 0.85)));
}

export function LeaderSkillDescText({ text, className }: Props) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [iconSize, setIconSize] = useState(12);
  const needs = skillDescNeedsRichRender(text);

  useLayoutEffect(() => {
    if (!needs) return;
    const el = textRef.current;
    if (!el) return;

    const update = () => {
      const lineHeight = readLineHeightPx(el);
      if (lineHeight != null) setIconSize(capInlineIconSize(lineHeight));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [needs, text, className]);

  if (!needs) {
    return <p className={className}>{text}</p>;
  }

  return (
    <p ref={textRef} className={className}>
      <SkillDescRichContent
        text={text}
        iconSize={iconSize}
        highlightAfterActivation={false}
      />
    </p>
  );
}
