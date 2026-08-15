/**
 * Build a debug APK via Gradle and copy it to releases/pad-searching-tool.apk.
 * Run from web/: node scripts/build-debug-apk.mjs
 * Or: npm run android:apk
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");
const repoRoot = join(webRoot, "..");
const androidDir = join(webRoot, "android");
const apkSrc = join(
  androidDir,
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk"
);
const releasesDir = join(repoRoot, "releases");
const apkDest = join(releasesDir, "pad-searching-tool.apk");

const isWin = process.platform === "win32";
const gradlew = join(androidDir, isWin ? "gradlew.bat" : "gradlew");

if (!existsSync(gradlew)) {
  console.error(`Gradle wrapper not found: ${gradlew}`);
  process.exit(1);
}

console.log("Building debug APK…");
const result = spawnSync(
  gradlew,
  ["assembleDebug", "--quiet"],
  {
    cwd: androidDir,
    stdio: "inherit",
    shell: isWin,
    env: process.env,
  }
);

if (result.status !== 0) {
  console.error("Gradle assembleDebug failed.");
  process.exit(result.status ?? 1);
}

if (!existsSync(apkSrc)) {
  console.error(`APK not found after build: ${apkSrc}`);
  process.exit(1);
}

mkdirSync(releasesDir, { recursive: true });
copyFileSync(apkSrc, apkDest);
console.log(`Copied → ${apkDest}`);
