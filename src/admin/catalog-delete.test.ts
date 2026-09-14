import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { deleteJsonSeed, isSafeSeedId } from "./catalog-delete.ts";

describe("isSafeSeedId", () => {
  it("allows slugs and numeric post ids", () => {
    assert.equal(isSafeSeedId("pad-x"), true);
    assert.equal(isSafeSeedId("80128597"), true);
  });

  it("rejects path traversal", () => {
    assert.equal(isSafeSeedId("../pad-x"), false);
    assert.equal(isSafeSeedId("pad/x"), false);
  });
});

describe("deleteJsonSeed", () => {
  it("removes an existing seed file and returns true", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-delete-"));
    const filePath = join(dir, "pad-x.json");
    writeFileSync(filePath, "{}\n");
    assert.equal(deleteJsonSeed(dir, "pad-x"), true);
    assert.equal(existsSync(filePath), false);
  });

  it("returns false when the seed is already gone", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-delete-"));
    assert.equal(deleteJsonSeed(dir, "pad-x"), false);
  });
});
