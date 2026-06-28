import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_DUNGEON_URLS_PATH = join(moduleRoot, "seed/dungeon-urls.txt");

/** @param {string} filePath */
export function readDungeonUrlList(filePath) {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter(Boolean);
}
