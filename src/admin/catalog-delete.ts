import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { rethrowIfReadonlyFs } from "./catalog-fs.ts";

export function isSafeSeedId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/** Deletes `<dir>/<id>.json`. Returns false if the file is already gone. */
export function deleteJsonSeed(dir: string, id: string): boolean {
  if (!isSafeSeedId(id)) {
    throw new Error(`Invalid catalog id: ${id}`);
  }
  const filePath = join(dir, `${id}.json`);
  if (!existsSync(filePath)) return false;
  try {
    unlinkSync(filePath);
  } catch (err) {
    rethrowIfReadonlyFs(err, filePath);
  }
  return true;
}
