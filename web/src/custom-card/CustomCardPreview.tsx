import { forwardRef } from "react";
import { MonsterDetailCard } from "../components/MonsterDetailCard";
import { draftToPreviewRow } from "./draft-to-row";
import type { CustomCardDraft } from "./types";

type Props = {
  draft: CustomCardDraft;
};

export const CustomCardPreview = forwardRef<HTMLDivElement, Props>(
  function CustomCardPreview({ draft }, ref) {
    const row = draftToPreviewRow(draft);
    const hasMeta =
      draft.level != null ||
      draft.maxLevel != null ||
      draft.plusHp != null ||
      draft.plusAtk != null ||
      draft.plusRcv != null ||
      draft.cost != null;
    return (
      <div ref={ref} className="mx-auto w-full max-w-[360px]">
        <MonsterDetailCard
          row={row}
          artSrc={draft.artObjectUrl}
          iconSrc={draft.iconObjectUrl}
          framedIcon
          hideUtilityLinks
          nameSub={draft.nameJa.trim() || null}
          statsMeta={
            hasMeta
              ? {
                  level: draft.level,
                  maxLevel: draft.maxLevel,
                  plusHp: draft.plusHp,
                  plusAtk: draft.plusAtk,
                  plusRcv: draft.plusRcv,
                  cost: draft.cost,
                }
              : null
          }
        />
      </div>
    );
  }
);
