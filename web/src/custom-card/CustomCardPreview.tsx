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
    return (
      <div ref={ref} className="mx-auto w-full max-w-[360px]">
        <MonsterDetailCard
          row={row}
          artSrc={draft.artObjectUrl}
          iconSrc={draft.iconObjectUrl}
          framedIcon
          hideUtilityLinks
        />
      </div>
    );
  }
);
