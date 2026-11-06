# In-app update: Android app updates itself from GitHub Releases — plan (2026-11-06)

Goal: a user running the Capacitor Android app can move to the **latest GitHub Release** from
inside the app, without uninstalling / manually sideloading. Two update channels, chosen
automatically per release:

- **Web bundle update (default, no install at all).** The React build (`web/dist-android`) is
  downloaded as a zip, unpacked into app storage and the WebView is pointed at it. The APK stays
  the same. This covers every release that only changes web code — which, given the native shell
  is an empty `BridgeActivity` with zero plugins today, is essentially every release so far.
- **APK update (fallback, in-place upgrade).** Only when a release changes the native shell
  (new Capacitor plugin, Capacitor major bump, Gradle/manifest change). The app downloads the APK
  and opens the system installer. Because CD signs every APK with the same pinned debug keystore,
  Android treats it as an upgrade: no uninstall, app data (team drafts, settings) kept. The user
  still taps "Install" once.

## 0. Current state (verified by reading code / probing, 2026-11-06)

| Area | Today |
|------|-------|
| App shell | `web/android/`, Capacitor **8.5.0**, `MainActivity extends BridgeActivity {}` with no plugins; `capacitor.build.gradle` has an empty dependency list. `appId com.hassasin.padsearchingtool`, `webDir dist-android`, minSdk 24, targetSdk 36. Manifest already declares a `FileProvider` (`${applicationId}.fileprovider`, `file_paths.xml` = external-path + cache-path) and only the `INTERNET` permission. |
| Versioning | CD computes `version = <major.minor from package.json>.<GITHUB_RUN_NUMBER>` (today `1.0.N`), tag `v1.0.N`, Gradle `versionCode = run_number`, `versionName = 1.0.N`. Local `npm run android:apk` builds `versionCode 1 / versionName 1.0`. The web build does **not** know its version (nothing in `vite.config.ts`, no `VITE_APP_VERSION`). |
| Releases | Repo is **public**. Every push to main → `.github/workflows/cd.yml`: test → (APK build ‖ deploy to Oracle VM) → `gh release create vX apk --latest`. Latest: `v1.0.4` with one asset `pad-searching-tool-v1.0.4.apk` (32 MB). Release body = changelog from `scripts/ci/generate-changelog.sh`. |
| GitHub endpoints | `GET api.github.com/repos/IAmHassasin/pad-searching-tool/releases/latest` → `Access-Control-Allow-Origin: *`, **60 req/h per IP** unauthenticated. Asset objects carry a `digest` field (`sha256:…`). `github.com/<repo>/releases/latest/download/<asset-name>` is a stable URL (302 → versioned URL → 302 → `release-assets.githubusercontent.com`, 200). **Asset downloads send no CORS header** → the WebView's `fetch()` cannot download assets; downloads must go through native code. |
| Capacitor swap-the-web-dir support | Built in, no plugin needed: `Bridge.setServerBasePath(path)` hosts files from a filesystem dir and reloads; `Bridge.loadWebView()` restores a persisted path from SharedPreferences `CapWebViewSettings.serverBasePath` at startup **unless** `isNewBinary()` (versionCode/versionName changed since last run → it clears the path and uses the built-in assets). The core `WebView` plugin exposes `setServerBasePath / getServerBasePath / persistServerBasePath` to JS. Bridge constructor order: `initWebView → registerAllPlugins (plugin.load()) → loadWebView`, so a plugin's `load()` runs **before** the persisted path is read — the right place for crash-loop rollback. |
| Native HTTP from JS | `CapacitorHttp` (`@capacitor/core` export, native plugin registered by default) does requests natively → no CORS, usable for small JSON. Not suitable for a 7 MB zip (base64 over the bridge) — the plugin downloads to disk instead. |
| Web bundle size | `web/dist-android` ≈ 2 MB stale build / `web/dist` ≈ 7 MB (icon-index.bin + sprites), ~15–30 files. Zip ≈ 5–7 MB. |
| Web app | No Capacitor import anywhere in `web/src`; "mobile webview" detection is viewport width / `?webview=1` (`useMobileWebview`). API base is `VITE_API_BASE` from gitignored `web/.env.android` (CI secret `ANDROID_ENV_FILE`). Routing is path-based in `main.tsx`; tool launcher = `AppToolsNav` / `lib/app-tools.ts`. |
| Tests | `npm test` = `node --test --experimental-strip-types` with an explicit file list in root `package.json`; relative imports need explicit `.ts`; JSON imports are not test-safe. |

## 1. Feasibility verdict

**Feasible, mostly with code already in Capacitor.** The web-bundle path needs: CI to publish the
bundle + a manifest, one small local Capacitor plugin (download, sha256, unzip, apply, rollback,
APK install), ~150 lines of pure TS for version logic, and a banner/modal in the UI. Nothing
needs a backend change: the Oracle VM API is deployed in the same CD run *before* the release is
created, so a bundle published on GitHub is always compatible with the live API.

Things that are **not** possible and are out of scope:

- A native-shell change can never be applied without the system installer. The plan detects this
  case and routes it to the APK channel instead of silently breaking.
- A locally built debug APK (`npm run android:apk` on a dev machine) uses the developer's own
  `~/.android/debug.keystore`; the CI APK will not install over it (signature mismatch,
  "App not installed"). Bundle updates still work on such a build. Documented, not solved.

## 2. Design

### 2.1 Versions and compatibility

- **Release version** = `1.0.N`, **versionCode** = `N` (unchanged). All comparisons are on the
  integer `N`; never semver-parse.
- **Web bundle version** is baked into the build via Vite `define`:
  `__APP_VERSION__ = "1.0.N"`, `__APP_VERSION_CODE__ = N` from env `APP_VERSION` /
  `APP_VERSION_CODE` exported by CI (local builds: `"0.0.0-dev"` / `0`).
- **`nativeApiLevel`** — one integer in `web/native-api-level.json` (`{ "nativeApiLevel": 1 }`).
  Bump it in the same PR as any native-shell change. It is read by **both** sides from that single
  file: `app/build.gradle` (JsonSlurper → `buildConfigField "int", "NATIVE_API_LEVEL"`, with
  `buildFeatures { buildConfig true }`) and Vite (`define __NATIVE_API_LEVEL__`), and CI copies it
  into the manifest. Rule in the client: `manifest.nativeApiLevel > installed.nativeApiLevel` →
  APK channel; otherwise bundle channel.

### 2.2 Release assets (CD)

Every release gets three assets:

| Asset | Content |
|---|---|
| `pad-searching-tool-v1.0.N.apk` | as today |
| `web-bundle-v1.0.N.zip` | zip of `web/dist-android/*` (index.html at zip root), from the **same** build the APK embeds |
| `update.json` | manifest, fixed name so `…/releases/latest/download/update.json` always resolves to the latest one |

`update.json`:

```json
{
  "schema": 1,
  "version": "1.0.42",
  "versionCode": 42,
  "nativeApiLevel": 1,
  "publishedAt": "2026-11-06T10:00:00Z",
  "bundle": { "url": "https://github.com/IAmHassasin/pad-searching-tool/releases/download/v1.0.42/web-bundle-v1.0.42.zip", "sha256": "…", "size": 6812345 },
  "apk":    { "url": "https://github.com/IAmHassasin/pad-searching-tool/releases/download/v1.0.42/pad-searching-tool-v1.0.42.apk", "sha256": "…", "size": 32356640 },
  "notesUrl": "https://github.com/IAmHassasin/pad-searching-tool/releases/tag/v1.0.42"
}
```

The client reads only `update.json` (via `CapacitorHttp`, no rate limit, no CORS). The GitHub API
is used only as an optional source for release notes text (body markdown), cached, and only when
the modal opens — it is not needed for the update itself.

Release creation becomes atomic for clients: `gh release create --draft`, upload all three
assets, then `gh release edit --draft=false --latest`. Today's single `gh release create` publishes
first and uploads after, which would let a client see a manifest whose zip does not exist yet.

### 2.3 Native plugin `AppUpdate` (Java, inside the app module)

`web/android/app/src/main/java/com/hassasin/padsearchingtool/AppUpdatePlugin.java`, registered
in `MainActivity.onCreate` with `registerPlugin(AppUpdatePlugin.class)` before `super.onCreate`.
JS side: `web/src/lib/app-update/plugin.ts` via `registerPlugin<AppUpdatePlugin>('AppUpdate')`
with a web stub that reports "not native" (so the browser build never calls it).

Storage layout (`filesDir/bundles/`): `<version>/` unpacked bundle, `<version>.tmp/` during
unpack, `pending.zip` during download. Plugin prefs (`SharedPreferences "AppUpdate"`):
`currentVersionCode`, `previousVersionCode`, `pendingVersionCode`, `lastBinaryVersionCode`,
`lastRollbackFrom`.

| Method | Behaviour |
|---|---|
| `getInfo()` | `{ versionName, versionCode, nativeApiLevel, bundle: { versionCode, path } \| null, lastRollbackFrom }` |
| `downloadBundle({ url, versionCode, sha256, size })` | `HttpURLConnection` (follows the two HTTPS redirects) → `pending.zip`, streaming sha256, abort if size or hash mismatch; unzip into `<v>.tmp` with zip-slip guard (`canonicalPath.startsWith(dir)`) and an entry-count / total-size cap; require `index.html`; rename to `<v>`. Emits `downloadProgress { received, total }`. Runs on a background thread; call resolves when the dir is ready. |
| `applyBundle({ versionCode })` | Sets `pendingVersionCode = v`, `previousVersionCode = current`, writes `CapWebViewSettings.serverBasePath = <path>`, then `bridge.setServerBasePath(path)` → WebView reloads on the new bundle. |
| `notifyReady()` | Called by the web app once React has mounted. If `pendingVersionCode` is set: `current = pending`, clear pending, delete every bundle dir except current and previous. |
| `rollbackToBuiltin()` | Clears `serverBasePath`, prefs → `""`, reload. Exposed for a "Reset app" action. |
| `downloadApk({ url, sha256, size })` | → `cacheDir/updates/<name>.apk`, same hash check. |
| `installApk({ path })` | If `!pm.canRequestPackageInstalls()` → open `ACTION_MANAGE_UNKNOWN_APP_SOURCES` for this package and resolve `{ needsPermission: true }`. Else `ACTION_VIEW` with the FileProvider `content://` URI (cache-path is already declared), `application/vnd.android.package-archive`, `FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK`. Needs `<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>`. |

`load()` (runs before the Bridge reads the persisted path):

1. If the binary changed (`lastBinaryVersionCode != pInfo.versionCode`): the built-in assets are
   newer than any bundle. Clear all plugin prefs, delete `bundles/`, record the new code. (Capacitor
   already cleared `serverBasePath` itself in `isNewBinary()`.)
2. Else if `pendingVersionCode` is set: the previous launch applied a bundle and never called
   `notifyReady()` → crash / white screen. Set `serverBasePath` to the previous bundle path (or `""`
   for built-in), `lastRollbackFrom = pending`, clear pending, delete the bad dir.
3. Else if `currentVersionCode` is set but its dir is missing (storage cleared): clear prefs.

### 2.4 Client library `web/src/lib/app-update/` (pure TS, unit-tested)

- `manifest.ts` — `parseUpdateManifest(json: unknown): UpdateManifest | null` (schema 1 only,
  every field validated, URLs must be `https://github.com/IAmHassasin/pad-searching-tool/…`).
- `decide.ts` — `decideUpdate(installed, manifest): UpdateDecision` where `installed =
  { versionCode, bundleVersionCode | null, nativeApiLevel }` →
  `{ kind: "none" } | { kind: "bundle", … } | { kind: "apk", reason: "native-shell" }`.
  Rules: effective code = `max(versionCode, bundleVersionCode ?? 0)`; `manifest.versionCode <=
  effective` → none (never downgrade); `manifest.nativeApiLevel > installed.nativeApiLevel` → apk;
  else bundle.
- `throttle.ts` — `shouldCheck(now, lastCheckedAt, trigger)` : automatic checks at most every
  6 h, manual always; dismissed version remembered (`pst.app-update.dismissed`).
- `client.ts` — `fetchManifest()` (`CapacitorHttp.get` on the fixed `latest/download/update.json`
  URL with a 10 s timeout), `runBundleUpdate(decision, onProgress)`, `runApkUpdate(…)`.
- `platform.ts` — `isNativeApp()` = `Capacitor.isNativePlatform()`; everything is a no-op in the
  browser build so the web deployment is untouched.

### 2.5 UI

- `useAppUpdate()` hook (native only): check 3 s after mount and on `appStateChange → active`
  (`@capacitor/app`, 8.1.2), throttled. State: `idle | checking | available(decision) |
  downloading(progress) | applying | error(msg) | needsInstallPermission`.
- Entry points: a small pill on the launcher (`AppToolsNav`) and in the mobile header next to
  `AppBrand`: "Update v1.0.42". Tapping opens `AppUpdateModal`: version, release notes (GitHub API
  body, plain-text rendered, optional), size, primary button "Update now" (bundle) or
  "Download & install" (APK), secondary "Later" (dismiss this version), "What is this?" link to the
  release page. Progress bar during download; bundle path ends with the automatic reload. A
  "Check for updates" row in the launcher triggers a manual check.
- After a rollback (`lastRollbackFrom` set) show a one-time notice "Update to v1.0.42 failed, the
  previous version was restored" with a "Report" link to GitHub issues.
- `main.tsx`: call `AppUpdate.notifyReady()` once after the first render (native only).

### 2.6 Security notes

- Manifest and assets are fetched over HTTPS from `github.com` only (URL allow-list in
  `parseUpdateManifest`); zip and APK are verified against the sha256 from the manifest, which CI
  computes from the exact files it uploaded. Trust anchor = control of the GitHub repo / Actions,
  the same anchor the APK itself already has.
- Zip extraction: zip-slip guard, entry cap (e.g. 2,000) and uncompressed-size cap (e.g. 200 MB).
- No bundle signing (Ed25519) in v1; it would protect against a compromised GitHub account only
  if the private key lives outside GitHub. Listed as a later option.
- `REQUEST_INSTALL_PACKAGES` is a normal permission with a per-app system toggle; the plan handles
  the "not yet allowed" state instead of crashing.

## 3. Alternatives considered

### A. Built-in Capacitor server-path switch + local plugin — **chosen**

Pros: no new npm dependency with cloud defaults; ~250 lines of Java; the swap/persist/binary-change
logic is Capacitor's own, used by Appflow Live Updates for years. Cons: we own download/unzip/
rollback code and must test it on a device.

### B. `@capgo/capacitor-updater` in manual mode (v8.54.2, MPL-2.0) — not chosen

Pros: download/unzip/checksum/`notifyAppReady` rollback already implemented. Cons: large plugin
built around Capgo's cloud (channels, stats, auto-update) that must be explicitly disabled
(`autoUpdate: false`, empty `statsUrl`/`updateUrl`); still needs a separate path for the APK
channel; adds ~2 MB and a dependency the project would have to track across Capacitor majors. Worth
revisiting only if the custom plugin grows beyond its small scope.

### C. Only "open the release page in the browser" — kept as Phase 1 fallback

Zero native code; the user still sideloads by hand. Shipped first because it is the same version
plumbing the real feature needs, and it already removes the "I did not know there was a new
version" problem.

## 4. Implementation plan

### 4.1 Version plumbing + release assets (no native code)

1. `web/native-api-level.json` with `{ "nativeApiLevel": 1 }`.
2. `web/vite.config.ts`: `define` for `__APP_VERSION__`, `__APP_VERSION_CODE__`,
   `__NATIVE_API_LEVEL__` (declare in `vite-env.d.ts`). Keep the JSON read in `vite.config.ts`,
   not in a module reachable from tests.
3. `web/android/app/build.gradle`: read the JSON, `buildConfigField "int", "NATIVE_API_LEVEL"`.
4. `cd.yml` `apk` job: export `APP_VERSION` / `APP_VERSION_CODE`; after `android:apk`, zip
   `web/dist-android` to `dist-release/web-bundle-$TAG.zip`, `sha256sum` both files, write
   `dist-release/update.json` (`scripts/ci/write-update-manifest.sh`, inputs: tag, run number,
   native level, file paths). Upload the whole `dist-release/` as the artifact.
5. `cd.yml` `release` job: `gh release create --draft` → `gh release upload` → `gh release edit
   --draft=false --latest`. Verify with `curl -sIL …/releases/latest/download/update.json`.
6. Web: `lib/app-update/{manifest,decide,throttle}.ts` + tests; `useAppUpdate` with the
   browser-safe `fetchManifest`; banner + modal whose primary action is **open the release page**
   (external browser) — the full channels land in 4.2 / 4.3.

### 4.2 Bundle channel (the "no reinstall" path)

1. `AppUpdatePlugin.java`: `getInfo`, `downloadBundle`, `applyBundle`, `notifyReady`,
   `rollbackToBuiltin`, `load()` rollback logic (§2.3). `MainActivity.registerPlugin`.
2. `@capacitor/app` for `getInfo()`/`appStateChange` (or fold `getInfo` into the plugin and skip the
   dependency — decide in 4.2 step 1, prefer fewer deps).
3. `client.ts` `runBundleUpdate`: `downloadBundle` → `applyBundle`; the reload happens natively.
4. `main.tsx`: `notifyReady()` after first paint on native.
5. Device test matrix (manual, documented in `web/android/README-update.md`):
   - install CI APK v1.0.N → publish v1.0.N+1 (web-only change) → in-app update → version shown
     is N+1, team drafts intact, kill + relaunch still N+1.
   - crash-loop: publish a test release whose bundle has a broken `index.html` as a **draft/
     prerelease on a test tag**, point a debug build at it via an env override of the manifest URL
     (`VITE_UPDATE_MANIFEST_URL`), confirm rollback notice.
   - storage cleared (Android "Clear storage") → app boots on built-in assets.
   - install a newer CI APK over a bundle-updated app → `isNewBinary` path, bundles pruned.

### 4.3 APK channel

1. Manifest permission `REQUEST_INSTALL_PACKAGES`; plugin `downloadApk`, `installApk`,
   `canInstall` (permission state).
2. `client.ts` `runApkUpdate`; modal states for the permission detour (user returns from settings →
   re-check and continue).
3. Test: bump `nativeApiLevel` on a test release; app offers the APK; install keeps data.

### 4.4 Done criteria

- Browser build has no behavioural change (`Capacitor.isNativePlatform()` false → hook inert).
- `npm test` includes the new `app-update` tests; `vite build` and `android:apk` succeed; CI
  publishes three assets and `latest/download/update.json` resolves.
- A device moves N → N+1 via bundle in under 1 minute on Wi-Fi with no installer prompt; N → N+1
  with a bumped `nativeApiLevel` via installer with data kept; a broken bundle rolls back
  automatically.
- README "Android app" section documents the update channels, the `nativeApiLevel` bump rule, the
  draft-then-publish release flow, and the local-keystore limitation.

## 5. Phasing

| Phase | Scope | Value |
|---|---|---|
| 1 | §4.1 — versions, manifest, CI assets, banner → release page | users learn about updates; CI contract fixed; low risk |
| 2 | §4.2 — bundle download/apply/rollback | the actual "update without reinstall" |
| 3 | §4.3 — APK channel | native-shell releases become self-serve too |
| later | optional: Ed25519 bundle signature; delta zips; "update on Wi-Fi only" setting | hardening |

## 6. Risks and unknowns

- **Unverified on a device**: `setServerBasePath` behaviour with Capacitor 8.5 at runtime (only
  read from source), `HttpURLConnection` following the GitHub → `release-assets` redirect chain
  on Android, and the installer intent on targetSdk 36. Phase 2 starts with a spike build that
  exercises exactly these three before any UI work.
- **Release ordering**: `latest/download/update.json` and the API deploy are independent; the
  `release` job already `needs: deploy`, keep that dependency so a bundle never precedes its API.
- **Rate limits**: avoided for the check (no API call). Release notes via the API are optional and
  cached; failures degrade to "see release page".
- **Old installs** (v1.0.4 and earlier) have no updater; they need one last manual sideload.
- **`isNewBinary()` also fires on versionName change**; local builds (`1.0` / code 1) and CI
  builds never collide in practice because they are never installed over each other.
- **Zip size growth**: `icon-index.bin` and sprites are inside the bundle; a 10 MB+ download on
  mobile data is acceptable but a Wi-Fi-only toggle is cheap to add later.

## 7. Decisions needed before Phase 2

1. Confirm the channel split (bundle by default, APK only on `nativeApiLevel` bump) — assumed yes.
2. Automatic check cadence: on launch + resume, max every 6 h — assumed; alternative is manual only.
3. Whether to add `@capacitor/app` (8.1.2) or keep everything inside the local plugin — assumed
   local plugin only, to keep `capacitor.build.gradle` dependency-free.
4. **Closed 2026-11-06 (user): keep publishing the APK** as a release asset and the `releases/`
   download link in README (first install still needs it).
