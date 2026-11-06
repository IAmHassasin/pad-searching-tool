import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_UPDATE_REPO_URL,
  manifestUrlFor,
  parseUpdateManifest,
} from "./manifest.ts";

const SHA = "a".repeat(64);

function validManifest(): Record<string, unknown> {
  return {
    schema: 1,
    version: "1.0.42",
    versionCode: 42,
    nativeApiLevel: 1,
    publishedAt: "2026-11-06T10:00:00Z",
    bundle: {
      url: `${DEFAULT_UPDATE_REPO_URL}/releases/download/v1.0.42/web-bundle-v1.0.42.zip`,
      sha256: SHA,
      size: 6_812_345,
    },
    apk: {
      url: `${DEFAULT_UPDATE_REPO_URL}/releases/download/v1.0.42/pad-searching-tool-v1.0.42.apk`,
      sha256: SHA,
      size: 32_356_640,
    },
    notesUrl: `${DEFAULT_UPDATE_REPO_URL}/releases/tag/v1.0.42`,
  };
}

describe("parseUpdateManifest", () => {
  it("accepts a complete manifest", () => {
    const parsed = parseUpdateManifest(validManifest());
    assert.ok(parsed);
    assert.equal(parsed.version, "1.0.42");
    assert.equal(parsed.versionCode, 42);
    assert.equal(parsed.nativeApiLevel, 1);
    assert.equal(parsed.bundle.size, 6_812_345);
    assert.equal(parsed.apk.sha256, SHA);
    assert.equal(parsed.notesUrl, `${DEFAULT_UPDATE_REPO_URL}/releases/tag/v1.0.42`);
  });

  it("treats missing optional fields as null", () => {
    const input = validManifest();
    delete input.publishedAt;
    delete input.notesUrl;
    const parsed = parseUpdateManifest(input);
    assert.ok(parsed);
    assert.equal(parsed.publishedAt, null);
    assert.equal(parsed.notesUrl, null);
  });

  it("rejects non-objects and unknown schemas", () => {
    assert.equal(parseUpdateManifest(null), null);
    assert.equal(parseUpdateManifest("1.0.42"), null);
    assert.equal(parseUpdateManifest([]), null);
    assert.equal(parseUpdateManifest({ ...validManifest(), schema: 2 }), null);
  });

  it("rejects malformed version fields", () => {
    assert.equal(parseUpdateManifest({ ...validManifest(), version: "" }), null);
    assert.equal(parseUpdateManifest({ ...validManifest(), versionCode: 0 }), null);
    assert.equal(parseUpdateManifest({ ...validManifest(), versionCode: "42" }), null);
    assert.equal(parseUpdateManifest({ ...validManifest(), versionCode: 4.2 }), null);
    assert.equal(parseUpdateManifest({ ...validManifest(), nativeApiLevel: -1 }), null);
  });

  it("rejects assets outside the repository's release downloads", () => {
    const input = validManifest();
    (input.bundle as Record<string, unknown>).url =
      "https://example.com/web-bundle.zip";
    assert.equal(parseUpdateManifest(input), null);

    const otherRepo = validManifest();
    (otherRepo.apk as Record<string, unknown>).url =
      "https://github.com/someone-else/pad-searching-tool/releases/download/v1/app.apk";
    assert.equal(parseUpdateManifest(otherRepo), null);
  });

  it("rejects bad checksums and sizes", () => {
    const shortSha = validManifest();
    (shortSha.bundle as Record<string, unknown>).sha256 = "abc";
    assert.equal(parseUpdateManifest(shortSha), null);

    const upperSha = validManifest();
    (upperSha.bundle as Record<string, unknown>).sha256 = "A".repeat(64);
    assert.equal(parseUpdateManifest(upperSha), null);

    const zeroSize = validManifest();
    (zeroSize.apk as Record<string, unknown>).size = 0;
    assert.equal(parseUpdateManifest(zeroSize), null);
  });

  it("rejects release notes links outside the repository", () => {
    assert.equal(
      parseUpdateManifest({ ...validManifest(), notesUrl: "https://example.com/notes" }),
      null
    );
    assert.equal(parseUpdateManifest({ ...validManifest(), notesUrl: 42 }), null);
  });

  it("validates against a custom repository URL", () => {
    const repo = "https://github.com/fork/pad-searching-tool/";
    const input = validManifest();
    (input.bundle as Record<string, unknown>).url =
      "https://github.com/fork/pad-searching-tool/releases/download/v1.0.42/web-bundle.zip";
    (input.apk as Record<string, unknown>).url =
      "https://github.com/fork/pad-searching-tool/releases/download/v1.0.42/app.apk";
    input.notesUrl = "https://github.com/fork/pad-searching-tool/releases/tag/v1.0.42";
    assert.ok(parseUpdateManifest(input, repo));
    assert.equal(parseUpdateManifest(validManifest(), repo), null);
  });
});

describe("manifestUrlFor", () => {
  it("builds the stable latest-release asset URL", () => {
    assert.equal(
      manifestUrlFor("https://github.com/IAmHassasin/pad-searching-tool/"),
      "https://github.com/IAmHassasin/pad-searching-tool/releases/latest/download/update.json"
    );
  });
});
