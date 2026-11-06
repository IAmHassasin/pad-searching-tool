/** Automatic checks run at most this often; a manual check always runs. */
export const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const LAST_CHECKED_KEY = "pst.app-update.lastCheckedAt";
export const DISMISSED_KEY = "pst.app-update.dismissedVersionCode";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type UpdateStore = {
  lastCheckedAt: number | null;
  dismissedVersionCode: number | null;
};

export function shouldAutoCheck(
  now: number,
  lastCheckedAt: number | null,
  interval: number = AUTO_CHECK_INTERVAL_MS
): boolean {
  if (lastCheckedAt === null) return true;
  // A clock that moved backwards must not silence checks forever.
  if (lastCheckedAt > now) return true;
  return now - lastCheckedAt >= interval;
}

export function isDismissed(
  dismissedVersionCode: number | null,
  candidateVersionCode: number
): boolean {
  return dismissedVersionCode !== null && dismissedVersionCode === candidateVersionCode;
}

function readInt(storage: StorageLike, key: string): number | null {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

export function readUpdateStore(storage: StorageLike): UpdateStore {
  return {
    lastCheckedAt: readInt(storage, LAST_CHECKED_KEY),
    dismissedVersionCode: readInt(storage, DISMISSED_KEY),
  };
}

export function writeLastChecked(storage: StorageLike, now: number): void {
  try {
    storage.setItem(LAST_CHECKED_KEY, String(now));
  } catch {
    /* throttling degrades to "check every launch" */
  }
}

export function writeDismissed(
  storage: StorageLike,
  versionCode: number | null
): void {
  try {
    if (versionCode === null) storage.removeItem(DISMISSED_KEY);
    else storage.setItem(DISMISSED_KEY, String(versionCode));
  } catch {
    /* the banner simply shows again next time */
  }
}
