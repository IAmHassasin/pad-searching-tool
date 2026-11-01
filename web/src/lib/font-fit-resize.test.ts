import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fontFitWidthChanged } from "./font-fit-resize.ts";

describe("fontFitWidthChanged", () => {
  it("remeasures on the first width sample", () => {
    assert.equal(fontFitWidthChanged(null, 320), true);
  });

  it("ignores height-only layout changes that report the same width", () => {
    assert.equal(fontFitWidthChanged(320, 320), false);
    assert.equal(fontFitWidthChanged(320, 320.4), false);
  });

  it("remeasures when the text column width actually changes", () => {
    assert.equal(fontFitWidthChanged(320, 300), true);
    assert.equal(fontFitWidthChanged(320, 320.5), true);
  });
});
