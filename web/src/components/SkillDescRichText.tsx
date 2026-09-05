import type { ReactNode } from "react";
import { isAfterActivationMarker } from "../lib/format-active-skill-desc";
import {
  isAwoskillTemplate,
  isMonsterTypeTemplate,
  isSkillEffectTemplate,
  parseAwoskillTemplateId,
  parseMonsterTypeTemplateId,
  parseSkillEffectTemplateId,
} from "../lib/format-leader-skill-desc";
import { AwakeningSpriteIcon } from "./AwakeningSpriteIcon";
import { MonsterTypeSpriteIcon } from "./MonsterTypeSpriteIcon";
import { SkillEffectSpriteIcon } from "./SkillEffectSpriteIcon";

/** Inline awk / type / skill-effect icons + delayed-effect markers. */
const RICH_SKILL_SPLIT_RE =
  /(\{\{\s*awoskills\.id\d+(?:\|default\([^)]*\))?\s*\}\}|\{\{\s*types\.id\d+(?:\|default\([^)]*\))?\s*\}\}|\{\{\s*skilleffects\.id\d+(?:\|default\([^)]*\))?\s*\}\}|\[\d+ turns? after activation\])/gi;

export function skillDescNeedsRichRender(text: string): boolean {
  RICH_SKILL_SPLIT_RE.lastIndex = 0;
  return RICH_SKILL_SPLIT_RE.test(text);
}

function isRichSegment(part: string): boolean {
  return (
    isAwoskillTemplate(part) ||
    isMonsterTypeTemplate(part) ||
    isSkillEffectTemplate(part) ||
    isAfterActivationMarker(part)
  );
}

/** Render one line/paragraph with inline awakening / type / effect icons. */
export function SkillDescRichContent({
  text,
  iconSize,
  highlightAfterActivation = true,
}: {
  text: string;
  iconSize?: number | null;
  highlightAfterActivation?: boolean;
}): ReactNode {
  const parts = text.split(RICH_SKILL_SPLIT_RE);
  const hasRich = parts.some(isRichSegment);
  if (!hasRich) return text;

  return parts.map((part, i) => {
    if (isAwoskillTemplate(part)) {
      const id = parseAwoskillTemplateId(part);
      if (id == null) return <span key={i}>{part}</span>;
      return (
        <AwakeningSpriteIcon
          key={i}
          awokenSkillId={id}
          size={iconSize ?? undefined}
          className="mx-0.5 inline-block align-middle"
        />
      );
    }
    if (isMonsterTypeTemplate(part)) {
      const id = parseMonsterTypeTemplateId(part);
      if (id == null) return <span key={i}>{part}</span>;
      return (
        <MonsterTypeSpriteIcon
          key={i}
          typeId={id}
          size={iconSize ?? undefined}
          className="mx-0.5 inline-block align-middle"
        />
      );
    }
    if (isSkillEffectTemplate(part)) {
      const id = parseSkillEffectTemplateId(part);
      if (id == null) return <span key={i}>{part}</span>;
      return (
        <SkillEffectSpriteIcon
          key={i}
          effectId={id}
          size={iconSize ?? undefined}
          className="mx-0.5 inline-block align-middle"
        />
      );
    }
    if (highlightAfterActivation && isAfterActivationMarker(part)) {
      return (
        <strong key={i} className="font-bold text-[#f5e6c8]">
          {part}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
