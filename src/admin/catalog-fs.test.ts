import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rethrowIfReadonlyFs } from "./catalog-fs.ts";

describe("rethrowIfReadonlyFs", () => {
  it("rewrites EROFS into a catalog write error", () => {
    const err = Object.assign(new Error("EROFS: read-only file system"), {
      code: "EROFS",
    });
    assert.throws(
      () => rethrowIfReadonlyFs(err, "/app/event/seed/events/pad-x.json"),
      /read-only filesystem.*pad-x\.json/
    );
  });

  it("rethrows unrelated errors", () => {
    const err = new Error("disk full");
    assert.throws(() => rethrowIfReadonlyFs(err, "/tmp/x"), /disk full/);
  });
});
