import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RequestRateLimit } from "./request-rate-limit.ts";

describe("RequestRateLimit", () => {
  it("allows up to the limit inside a window and resets after it", () => {
    const limit = new RequestRateLimit(2, 1000);
    assert.equal(limit.allow("a", 0), true);
    assert.equal(limit.allow("a", 10), true);
    assert.equal(limit.allow("a", 20), false);
    assert.equal(limit.allow("b", 20), true);
    assert.equal(limit.allow("a", 1000), true);
  });
});
