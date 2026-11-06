import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchUpdateManifest,
  RUNNING_BUNDLE,
  runApkUpdate,
  runBundleUpdate,
} from "../lib/app-update/client";
import { decideUpdate, type ActionableDecision } from "../lib/app-update/decide";
import { isNativeApp } from "../lib/app-update/platform";
import { AppUpdate, type AppUpdateInfo } from "../lib/app-update/plugin";
import {
  isDismissed,
  readUpdateStore,
  shouldAutoCheck,
  writeDismissed,
  writeLastChecked,
} from "../lib/app-update/throttle";

/** Delay before the first automatic check, so the page settles first. */
const FIRST_CHECK_DELAY_MS = 3_000;

export type UpdateStatus =
  | { kind: "idle"; lastResult: "unknown" | "up-to-date" | "failed" }
  | { kind: "checking" }
  | { kind: "available"; decision: ActionableDecision }
  | { kind: "downloading"; decision: ActionableDecision; received: number; total: number }
  | { kind: "applying"; decision: ActionableDecision }
  | { kind: "needs-install-permission"; decision: ActionableDecision }
  | { kind: "error"; message: string; decision: ActionableDecision | null };

export type AppUpdateController = {
  /** False outside the Android shell; every other field is then inert. */
  enabled: boolean;
  info: AppUpdateInfo | null;
  running: typeof RUNNING_BUNDLE;
  status: UpdateStatus;
  rollbackFrom: number | null;
  check: (manual: boolean) => Promise<void>;
  start: () => Promise<void>;
  dismiss: () => void;
  acknowledgeRollback: () => Promise<void>;
  resetToBuiltin: () => Promise<void>;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Unknown error";
}

const IDLE_UNKNOWN: UpdateStatus = { kind: "idle", lastResult: "unknown" };

export function useAppUpdate(): AppUpdateController {
  const enabled = isNativeApp();
  const [info, setInfo] = useState<AppUpdateInfo | null>(null);
  const [status, setStatusState] = useState<UpdateStatus>(IDLE_UNKNOWN);
  const [rollbackFrom, setRollbackFrom] = useState<number | null>(null);
  const statusRef = useRef<UpdateStatus>(IDLE_UNKNOWN);
  const infoRef = useRef<AppUpdateInfo | null>(null);

  const setStatus = useCallback((next: UpdateStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const check = useCallback(
    async (manual: boolean) => {
      if (!enabled) return;
      const current = statusRef.current;
      if (
        current.kind === "checking" ||
        current.kind === "downloading" ||
        current.kind === "applying"
      ) {
        return;
      }
      const store = readUpdateStore(localStorage);
      const now = Date.now();
      if (!manual && !shouldAutoCheck(now, store.lastCheckedAt)) return;

      setStatus({ kind: "checking" });
      let installed = infoRef.current;
      try {
        if (!installed) {
          installed = await AppUpdate.getInfo();
          infoRef.current = installed;
          setInfo(installed);
        }
        const manifest = await fetchUpdateManifest();
        writeLastChecked(localStorage, now);
        if (!manifest) {
          setStatus(
            manual
              ? { kind: "error", message: "Could not read the latest release.", decision: null }
              : { kind: "idle", lastResult: "failed" }
          );
          return;
        }
        const decision = decideUpdate(
          {
            versionCode: installed.versionCode,
            bundleVersionCode: RUNNING_BUNDLE.versionCode,
            nativeApiLevel: installed.nativeApiLevel,
          },
          manifest
        );
        if (decision.kind === "none") {
          setStatus({ kind: "idle", lastResult: "up-to-date" });
          return;
        }
        if (!manual && isDismissed(store.dismissedVersionCode, manifest.versionCode)) {
          setStatus({ kind: "idle", lastResult: "up-to-date" });
          return;
        }
        setStatus({ kind: "available", decision });
      } catch (error) {
        setStatus(
          manual
            ? { kind: "error", message: errorMessage(error), decision: null }
            : { kind: "idle", lastResult: "failed" }
        );
      }
    },
    [enabled, setStatus]
  );

  const start = useCallback(async () => {
    const current = statusRef.current;
    const decision =
      current.kind === "available" ||
      current.kind === "error" ||
      current.kind === "needs-install-permission"
        ? current.decision
        : null;
    if (!decision) return;
    const total = decision.kind === "bundle" ? decision.manifest.bundle.size : decision.manifest.apk.size;
    setStatus({ kind: "downloading", decision, received: 0, total });
    try {
      if (decision.kind === "bundle") {
        setStatus({ kind: "downloading", decision, received: 0, total });
        await runBundleUpdate(decision);
        // applyBundle reloads the WebView; this state only shows if the reload is slow.
        setStatus({ kind: "applying", decision });
        return;
      }
      const { needsPermission } = await runApkUpdate(decision);
      if (needsPermission) {
        setStatus({ kind: "needs-install-permission", decision });
      } else {
        // The system installer took over; keep the offer in case the user cancels it.
        setStatus({ kind: "available", decision });
      }
    } catch (error) {
      setStatus({ kind: "error", message: errorMessage(error), decision });
    }
  }, [setStatus]);

  const dismiss = useCallback(() => {
    const current = statusRef.current;
    if (current.kind === "available" || current.kind === "error") {
      writeDismissed(localStorage, current.decision?.manifest.versionCode ?? null);
    }
    setStatus({ kind: "idle", lastResult: "unknown" });
  }, [setStatus]);

  const acknowledgeRollback = useCallback(async () => {
    setRollbackFrom(null);
    try {
      await AppUpdate.acknowledgeRollback();
    } catch (error) {
      console.warn("AppUpdate.acknowledgeRollback failed", error);
    }
  }, []);

  const resetToBuiltin = useCallback(async () => {
    try {
      await AppUpdate.rollbackToBuiltin();
    } catch (error) {
      setStatus({ kind: "error", message: errorMessage(error), decision: null });
    }
  }, [setStatus]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    const boot = async () => {
      try {
        // Confirms this bundle booted; without it the native side rolls back on next launch.
        await AppUpdate.notifyReady();
      } catch (error) {
        console.warn("AppUpdate.notifyReady failed", error);
      }
      try {
        const next = await AppUpdate.getInfo();
        if (cancelled) return;
        infoRef.current = next;
        setInfo(next);
        setRollbackFrom(next.lastRollbackFrom);
      } catch (error) {
        console.warn("AppUpdate.getInfo failed", error);
      }
      try {
        handles.push(
          await AppUpdate.addListener("downloadProgress", ({ received, total }) => {
            const current = statusRef.current;
            if (current.kind !== "downloading") return;
            setStatus({ ...current, received, total: total > 0 ? total : current.total });
          })
        );
        handles.push(
          await AppUpdate.addListener("appResumed", () => {
            void check(false);
          })
        );
      } catch (error) {
        console.warn("AppUpdate listeners failed", error);
      }
    };
    void boot();

    const timer = window.setTimeout(() => {
      void check(false);
    }, FIRST_CHECK_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      for (const handle of handles) void handle.remove();
    };
  }, [enabled, check, setStatus]);

  return {
    enabled,
    info,
    running: RUNNING_BUNDLE,
    status,
    rollbackFrom,
    check,
    start,
    dismiss,
    acknowledgeRollback,
    resetToBuiltin,
  };
}
