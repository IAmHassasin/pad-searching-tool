import type { MonsterRecord } from "../types";

export const SEARCH_FIRST_PAGE_SIZE = 80;
export const SEARCH_NEXT_PAGE_SIZE = 5000;

export type SearchPageRequest = {
  offset: number;
  limit: number;
  skipCount: boolean;
};

export type SearchSnapshot = {
  rows: MonsterRecord[];
  total: number;
  minMonsterId: number;
  modernOnly: boolean;
};

/**
 * Next page for Approach A. `total === 0` means a completed empty count.
 * Pass `Number.POSITIVE_INFINITY` before the first COUNT returns.
 */
export function nextSearchPage(
  loaded: number,
  total: number
): SearchPageRequest | null {
  if (loaded === 0 && total !== 0) {
    return {
      offset: 0,
      limit: SEARCH_FIRST_PAGE_SIZE,
      skipCount: false,
    };
  }
  if (total <= 0 || loaded >= total) return null;
  return {
    offset: loaded,
    limit: SEARCH_NEXT_PAGE_SIZE,
    skipCount: true,
  };
}
