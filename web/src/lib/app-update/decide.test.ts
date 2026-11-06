import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideUpdate, effectiveVersionCode } from "./decide.ts";
import type { UpdateManifest } from "./manifest.ts";

function manifest(versionCode: number, nativeApiLevel = 1): UpdateManifest {
  const asset = { url: "https://github.com/x/y/releases/download/v/a", sha256: "0".repeat(64), size: 1 };
  return {
    schema: 1,
    version: `1.0.${versionCode}`,
    versionCode,
    nativeApiLevel,
    publishedAt: null,
    bundle: asset,
    apk: asset,
    notesUrl: null,
  };
}

describe("effectiveVersionCode", () => {
  it("is the newer of the APK and the running bundle", () => {
    assert.equal(effectiveVersionCode({ versionCode: 10, bundleVersionCode: null, nativeApiLevel: 1 }), 10);
    assert.equal(effectiveVersionCode({ versionCode: 10, bundleVersionCode: 12, nativeApiLevel: 1 }), 12);
    assert.equal(effectiveVersionCode({ versionCode: 15, bundleVersionCode: 12, nativeApiLevel: 1 }), 15);
  });
});

describe("decideUpdate", () => {
  const installed = { versionCode: 10, bundleVersionCode: null, nativeApiLevel: 1 };

  it("does nothing when the release is not newer", () => {
    assert.deepEqual(decideUpdate(installed, manifest(10)), { kind: "none" });
    assert.deepEqual(decideUpdate(installed, manifest(9)), { kind: "none" });
  });

  it("does not re-offer a bundle that already runs", () => {
    const withBundle = { ...installed, bundleVersionCode: 12 };
    assert.deepEqual(decideUpdate(withBundle, manifest(12)), { kind: "none" });
    assert.equal(decideUpdate(withBundle, manifest(13)).kind, "bundle");
  });

  it("offers the web bundle when the native shell is compatible", () => {
    const decision = decideUpdate(installed, manifest(11, 1));
    assert.equal(decision.kind, "bundle");
    assert.equal(decideUpdate(installed, manifest(11, 0)).kind, "bundle");
  });

  it("offers the APK when the release needs a newer native shell", () => {
    const decision = decideUpdate(installed, manifest(11, 2));
    assert.equal(decision.kind, "apk");
    assert.equal(decision.kind === "apk" && decision.reason, "native-shell");
  });

  it("prefers no update over an APK when the release is older", () => {
    assert.deepEqual(decideUpdate(installed, manifest(10, 2)), { kind: "none" });
  });
});
