import { parseMonsterAttributeIds } from "../lib/monster-attributes";
import type { MonsterRecord } from "../types";
import { MonsterAttributeStrip } from "./MonsterAttributeStrip";

type Props = {
  row: MonsterRecord;
  /** Smaller icons for cramped mobile split view. */
  minimal?: boolean;
};

export function MonsterRowIdentityChips({ row, minimal = false }: Props) {
  const iconSize = minimal ? 14 : 16;
  const attributeIds = parseMonsterAttributeIds(row);
  const primaryAttr = attributeIds[0];

  if (minimal) {
    if (primaryAttr == null) return null;
    return (
      <MonsterAttributeStrip attributeIds={[primaryAttr]} size={iconSize} bare />
    );
  }

  if (!attributeIds.length) return null;

  return (
    <MonsterAttributeStrip attributeIds={attributeIds} size={iconSize} bare />
  );
}
