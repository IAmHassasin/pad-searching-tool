import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTO_CHECK_INTERVAL_MS,
  DISMISSED_KEY,
  isDismissed,
  LAST_CHECKED_KEY,
  readUpdateStore,
  shouldAutoCheck,
  writeDismissed,
  writeLastChecked,
  type StorageLike,
} from "./throttle.ts";

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

describe("shouldAutoCheck", () => {
  const now = 1_800_000_000_000;

  it("checks when never checked before", () => {
    assert.equal(shouldAutoCheck(now, null), true);
  });

  it("waits for the interval to pass", () => {
    assert.equal(shouldAutoCheck(now, now - AUTO_CHECK_INTERVAL_MS + 1), false);
    assert.equal(shouldAutoCheck(now, now - AUTO_CHECK_INTERVAL_MS), true);
  });

  it("checks again when the clock went backwards", () => {
    assert.equal(shouldAutoCheck(now, now + 60_000), true);
  });
});

describe("isDismissed", () => {
  it("matches only the dismissed version", () => {
    assert.equal(isDismissed(null, 42), false);
    assert.equal(isDismissed(42, 42), true);
    assert.equal(isDismissed(42, 43), false);
  });
});

describe("update store", () => {
  it("round-trips values", () => {
    const storage = memoryStorage();
    writeLastChecked(storage, 123);
    writeDismissed(storage, 42);
    assert.deepEqual(readUpdateStore(storage), { lastCheckedAt: 123, dismissedVersionCode: 42 });
    writeDismissed(storage, null);
    assert.equal(readUpdateStore(storage).dismissedVersionCode, null);
  });

  it("ignores corrupt values", () => {
    const storage = memoryStorage();
    storage.data.set(LAST_CHECKED_KEY, "yesterday");
    storage.data.set(DISMISSED_KEY, "-1");
    assert.deepEqual(readUpdateStore(storage), { lastCheckedAt: null, dismissedVersionCode: null });
  });

  it("survives a throwing storage", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    assert.deepEqual(readUpdateStore(broken), { lastCheckedAt: null, dismissedVersionCode: null });
    assert.doesNotThrow(() => writeLastChecked(broken, 1));
    assert.doesNotThrow(() => writeDismissed(broken, 1));
  });
});
