import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SEARCH_FIRST_PAGE_SIZE,
  SEARCH_NEXT_PAGE_SIZE,
  nextSearchPage,
} from "./search-paging.ts";

describe("nextSearchPage", () => {
  it("starts with the small first page at offset 0", () => {
    assert.deepEqual(nextSearchPage(0, 9000), {
      offset: 0,
      limit: SEARCH_FIRST_PAGE_SIZE,
      skipCount: false,
    });
    assert.deepEqual(nextSearchPage(0, Number.POSITIVE_INFINITY), {
      offset: 0,
      limit: SEARCH_FIRST_PAGE_SIZE,
      skipCount: false,
    });
    assert.equal(SEARCH_FIRST_PAGE_SIZE, 80);
  });

  it("fetches the remainder in large pages and skips COUNT", () => {
    assert.deepEqual(nextSearchPage(80, 9000), {
      offset: 80,
      limit: SEARCH_NEXT_PAGE_SIZE,
      skipCount: true,
    });
    assert.equal(SEARCH_NEXT_PAGE_SIZE, 5000);
  });

  it("stops when loaded covers total", () => {
    assert.equal(nextSearchPage(80, 80), null);
    assert.equal(nextSearchPage(50, 50), null);
    assert.equal(nextSearchPage(0, 0), null);
  });
});
