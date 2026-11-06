import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAppUpdate, type AppUpdateController } from "../hooks/useAppUpdate";
import { useMobileWebview } from "../hooks/useMobileWebview";
import { fetchReleaseNotes, updateRepoUrl } from "../lib/app-update/client";

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function chipLabel(update: AppUpdateController): {
  text: string;
  tone: "muted" | "accent" | "warn";
} {
  if (update.rollbackFrom !== null) return { text: "Update failed", tone: "warn" };
  const { status } = update;
  switch (status.kind) {
    case "available":
    case "needs-install-permission":
      return { text: `Update v${status.decision.manifest.version}`, tone: "accent" };
    case "downloading": {
      const pct =
        status.total > 0 ? Math.min(100, Math.round((status.received / status.total) * 100)) : 0;
      return { text: `Updating ${pct}%`, tone: "accent" };
    }
    case "applying":
      return { text: "Restarting…", tone: "accent" };
    case "checking":
      return { text: "Checking…", tone: "muted" };
    case "error":
      return { text: status.decision ? `Update v${status.decision.manifest.version}` : "Update", tone: "warn" };
    default:
      return { text: `v${update.running.version}`, tone: "muted" };
  }
}

/**
 * Android-only entry point for in-app updates: a small version chip that opens
 * the update dialog. Renders nothing in the browser build.
 */
export function AppUpdateLaunch() {
  const update = useAppUpdate();
  const [open, setOpen] = useState(false);
  const isMobile = useMobileWebview();

  if (!update.enabled) return null;

  const onSearch = window.location.pathname.replace(/\/+$/, "") === "";
  const bottom =
    isMobile && onSearch
      ? "calc(env(safe-area-inset-bottom) + 5.25rem)"
      : "calc(env(safe-area-inset-bottom) + 1.25rem)";
  const { text, tone } = chipLabel(update);
  const toneClass =
    tone === "accent"
      ? "border-amber-200/40 bg-[var(--color-accent)] text-slate-950"
      : tone === "warn"
        ? "border-red-400/50 bg-red-500/90 text-white"
        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)]";

  return (
    <>
      <div className="pointer-events-none fixed right-3 z-40" style={{ bottom }}>
        <button
          type="button"
          aria-label="App updates"
          className={`pressable pointer-events-auto inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${toneClass}`}
          onClick={() => setOpen(true)}
        >
          {text}
        </button>
      </div>
      {open &&
        createPortal(
          <AppUpdateDialog update={update} onClose={() => setOpen(false)} />,
          document.body
        )}
    </>
  );
}

function AppUpdateDialog({
  update,
  onClose,
}: {
  update: AppUpdateController;
  onClose: () => void;
}) {
  const { status, info, running } = update;
  const decision =
    status.kind === "available" ||
    status.kind === "downloading" ||
    status.kind === "applying" ||
    status.kind === "needs-install-permission"
      ? status.decision
      : status.kind === "error"
        ? status.decision
        : null;
  const [notes, setNotes] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const version = decision?.manifest.version ?? null;
  useEffect(() => {
    if (!version) return;
    let cancelled = false;
    void fetchReleaseNotes(version).then((text) => {
      if (!cancelled) setNotes(text);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const busy = status.kind === "downloading" || status.kind === "applying" || status.kind === "checking";
  const releasesUrl = `${updateRepoUrl()}/releases`;
  const issuesUrl = `${updateRepoUrl()}/issues`;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-update-title"
        className="ds-float animate-sheet-in sm:animate-fade-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="app-update-title"
              className="text-sm font-bold uppercase tracking-wider text-[var(--color-accent-strong)]"
            >
              App updates
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Updates come from the project's GitHub releases.
            </p>
          </div>
          <button
            type="button"
            className="ds-btn pressable min-h-9 shrink-0 px-3 py-1 text-xs font-semibold"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <dl className="space-y-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-inset)] p-3 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-muted)]">Installed app</dt>
            <dd className="font-mono font-semibold text-[var(--color-fg-strong)]">
              {info ? `v${info.versionName}` : "…"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-muted)]">Running web bundle</dt>
            <dd className="font-mono font-semibold text-[var(--color-fg-strong)]">
              v{running.version}
              {info?.bundleVersionCode !== null && info?.bundleVersionCode !== undefined
                ? " (downloaded)"
                : " (built-in)"}
            </dd>
          </div>
          {decision ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-muted)]">Latest release</dt>
              <dd className="font-mono font-semibold text-[var(--color-accent-strong)]">
                v{decision.manifest.version}
              </dd>
            </div>
          ) : null}
        </dl>

        {update.rollbackFrom !== null ? (
          <section className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-xs">
            <p className="font-semibold text-[var(--color-fg-strong)]">
              The last update did not start correctly and was rolled back.
            </p>
            <p className="mt-1 text-[var(--color-muted)]">
              You are back on the previous version. If this keeps happening, please report it.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="ds-btn pressable min-h-9 px-3 py-1 text-xs font-semibold"
                onClick={() => void update.acknowledgeRollback()}
              >
                OK
              </button>
              <a
                href={issuesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ds-btn pressable inline-flex min-h-9 items-center px-3 py-1 text-xs font-semibold"
              >
                Report issue
              </a>
            </div>
          </section>
        ) : null}

        <section className="mt-3 text-xs">
          {status.kind === "idle" && status.lastResult === "up-to-date" ? (
            <p className="text-[var(--color-muted)]">You are on the latest version.</p>
          ) : null}
          {status.kind === "idle" && status.lastResult === "failed" ? (
            <p className="text-[var(--color-muted)]">
              The last automatic check could not reach GitHub. Try again below.
            </p>
          ) : null}
          {status.kind === "checking" ? (
            <p className="text-[var(--color-muted)]">Checking for updates…</p>
          ) : null}
          {status.kind === "error" ? (
            <p className="text-red-400">{status.message}</p>
          ) : null}
          {decision?.kind === "bundle" && status.kind !== "downloading" && status.kind !== "applying" ? (
            <p className="text-[var(--color-muted)]">
              Downloads {formatMegabytes(decision.manifest.bundle.size)} and restarts the app. No
              install prompt, your data is kept.
            </p>
          ) : null}
          {decision?.kind === "apk" && status.kind !== "downloading" ? (
            <p className="text-[var(--color-muted)]">
              This release changes the app itself ({formatMegabytes(decision.manifest.apk.size)}).
              Android will ask you to confirm the install; your data is kept.
            </p>
          ) : null}
          {status.kind === "needs-install-permission" ? (
            <p className="mt-1 text-amber-400">
              Allow "Install unknown apps" for PAD Searching Tool in the settings screen that
              opened, then come back and tap Install again.
            </p>
          ) : null}
          {status.kind === "downloading" ? (
            <div>
              <p className="text-[var(--color-muted)]">
                Downloading {formatMegabytes(status.received)} / {formatMegabytes(status.total)}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-inset)]">
                <div
                  className="h-full bg-[var(--color-accent)] transition-[width]"
                  style={{
                    width: `${status.total > 0 ? Math.min(100, (status.received / status.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
          {status.kind === "applying" ? (
            <p className="text-[var(--color-muted)]">Restarting on the new version…</p>
          ) : null}
        </section>

        {notes && decision ? (
          <section className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-inset)] p-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg-strong)]">
              What's new in v{decision.manifest.version}
            </h3>
            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-[11px] leading-snug text-[var(--color-fg)]">
              {notes}
            </pre>
          </section>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {decision && !busy ? (
            <button
              type="button"
              className="ds-btn-primary pressable min-h-9 px-4 py-1.5 text-xs"
              onClick={() => void update.start()}
            >
              {decision.kind === "bundle"
                ? status.kind === "error"
                  ? "Try again"
                  : "Update now"
                : status.kind === "needs-install-permission"
                  ? "Install"
                  : status.kind === "error"
                    ? "Try again"
                    : "Download & install"}
            </button>
          ) : null}
          {decision && !busy && status.kind !== "needs-install-permission" ? (
            <button
              type="button"
              className="ds-btn pressable min-h-9 px-3 py-1.5 text-xs font-semibold"
              onClick={() => {
                update.dismiss();
                onClose();
              }}
            >
              Later
            </button>
          ) : null}
          {!decision && !busy ? (
            <button
              type="button"
              className="ds-btn-primary pressable min-h-9 px-4 py-1.5 text-xs"
              onClick={() => void update.check(true)}
            >
              Check for updates
            </button>
          ) : null}
          <a
            href={releasesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ds-btn pressable inline-flex min-h-9 items-center px-3 py-1.5 text-xs font-semibold"
          >
            All releases
          </a>
        </div>

        {info?.bundleVersionCode !== null && info?.bundleVersionCode !== undefined && !busy ? (
          <button
            type="button"
            className="mt-4 text-[11px] text-[var(--color-muted)] underline"
            onClick={() => void update.resetToBuiltin()}
          >
            Reset to the version shipped with the app
          </button>
        ) : null}
      </div>
    </div>
  );
}
