export type SearchIdQueryResolution = {
  applyMinId: boolean;
  minMonsterId: number;
  exactId: number | null;
  likeQuery: string | null;
  modernOnly: boolean;
};

const DEFAULT_SEARCH_MIN_MONSTER_ID = 5000;
const NON_NEGATIVE_INT = /^\d+$/;

export function parseSearchMinMonsterId(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_SEARCH_MIN_MONSTER_ID;
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  if (!NON_NEGATIVE_INT.test(trimmed)) return DEFAULT_SEARCH_MIN_MONSTER_ID;
  return Number(trimmed);
}

export function resolveSearchIdQuery(
  idQuery: string | undefined,
  minMonsterId: number
): SearchIdQueryResolution {
  const floor =
    Number.isFinite(minMonsterId) && minMonsterId > 0 ? minMonsterId : 0;
  const applyFloor = floor > 0;
  const q = idQuery?.trim() ?? "";

  if (q === "") {
    return {
      applyMinId: applyFloor,
      minMonsterId: floor,
      exactId: null,
      likeQuery: null,
      modernOnly: applyFloor,
    };
  }

  if (NON_NEGATIVE_INT.test(q)) {
    return {
      applyMinId: false,
      minMonsterId: floor,
      exactId: Number(q),
      likeQuery: null,
      modernOnly: false,
    };
  }

  return {
    applyMinId: applyFloor,
    minMonsterId: floor,
    exactId: null,
    likeQuery: q,
    modernOnly: applyFloor,
  };
}
