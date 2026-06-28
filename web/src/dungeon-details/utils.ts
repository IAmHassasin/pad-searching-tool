import type { GimmickChip } from "./types";

export function gimmickMap(chips: GimmickChip[]) {
  return new Map(chips.map((g) => [g.id, g]));
}

export function stripPadTitle(titleJa: string) {
  return titleJa.replace(/^【パズドラ】/, "").trim();
}
