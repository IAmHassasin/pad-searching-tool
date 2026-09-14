import { useState, type FormEvent } from "react";
import { adminRefreshDb, adminRefreshDungeons, adminRefreshEvents } from "../api";

type Props = {
  variant?: "modal" | "inline";
  open?: boolean;
  onClose?: () => void;
  adminEnabled: boolean | null;
  isSuperadmin: boolean;
  checking: boolean;
  username: string | null;
  token: string | null;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => void;
  onRefreshComplete: () => void;
};

export function AdminPanel({
  variant = "modal",
  open = false,
  onClose,
  adminEnabled,
  isSuperadmin,
  checking,
  username,
  token,
  onLogin,
  onLogout,
  onRefreshComplete,
}: Props) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      await onLogin(user.trim(), pass);
      setPass("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!token || !confirm("Download community DB and merge into working SQLite?")) {
      return;
    }
    setRefreshError(null);
    setRefreshResult(null);
    setRefreshLoading(true);
    try {
      const res = await adminRefreshDb(token);
      const n = res.import.tablesReplaced.length;
      setRefreshResult(
        `Refresh OK at ${res.finishedAt}. ${n} table(s) updated from community dump.`
      );
      onRefreshComplete();
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshLoading(false);
    }
  };

  const handleRefreshDungeons = async () => {
    if (
      !token ||
      !confirm("Fetch AppMedia guerrilla/stage guides and import new dungeons?")
    ) {
      return;
    }
    setRefreshError(null);
    setRefreshResult(null);
    setRefreshLoading(true);
    try {
      const res = await adminRefreshDungeons(token);
      if (!res.added.length && !res.failed.length) {
        setRefreshResult(`No new dungeons. Checked at ${res.finishedAt}.`);
      } else {
        const fail =
          res.failed.length > 0
            ? ` ${res.failed.length} failed (${res.failed.map((f) => f.id).join(", ")}).`
            : "";
        setRefreshResult(
          `Dungeons: added ${res.added.length}${
            res.added.length ? ` (${res.added.join(", ")})` : ""
          }.${fail}`
        );
      }
      onRefreshComplete();
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshLoading(false);
    }
  };

  const handleRefreshEvents = async () => {
    if (
      !token ||
      !confirm("Fetch PAD US New Evolutions & Upgrades articles and update events?")
    ) {
      return;
    }
    setRefreshError(null);
    setRefreshResult(null);
    setRefreshLoading(true);
    try {
      const res = await adminRefreshEvents(token);
      if (!res.created.length && !res.unparsedArticles) {
        const skipped = res.skippedExisting.length
          ? ` Already listed: ${res.skippedExisting.join(", ")}.`
          : "";
        setRefreshResult(`No new events.${skipped} Checked at ${res.finishedAt}.`);
      } else {
        const parts = [
          res.created.length ? `created ${res.created.join(", ")}` : null,
          res.skippedExisting.length
            ? `already listed ${res.skippedExisting.join(", ")}`
            : null,
          res.unparsedArticles ? `${res.unparsedArticles} unparsed` : null,
        ].filter(Boolean);
        setRefreshResult(`Events: ${parts.join(" · ") || "no changes"}.`);
      }
      onRefreshComplete();
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshLoading(false);
    }
  };

  if (variant === "modal" && !open) return null;
  if (variant === "inline" && adminEnabled === false) return null;

  const fields = (
    <>
      {adminEnabled === false && (
        <p className="text-sm text-amber-300">
          Admin API is disabled on the server. Set ADMIN_USERNAME,
          ADMIN_PASSWORD, and ADMIN_JWT_SECRET in cloud secrets.
        </p>
      )}

      {adminEnabled !== false && checking && (
        <p className="text-sm text-[var(--color-muted)]">Checking session…</p>
      )}

      {adminEnabled && !checking && !isSuperadmin && (
        <form className="space-y-3" onSubmit={handleLogin}>
          <p className="text-xs text-[var(--color-muted)]">
            Sign in to refresh catalogs and delete event/dungeon pages.
          </p>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-muted)]">
            Username
            <input
              className="rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1.5 text-sm text-white"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-muted)]">
            Password
            <input
              type="password"
              className="rounded border border-[var(--color-border)] bg-[#0d1117] px-2 py-1.5 text-sm text-white"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {loginError && <p className="text-xs text-red-300">{loginError}</p>}
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full rounded bg-[#1f6feb] px-3 py-2 text-sm font-medium text-white hover:bg-[#388bfd] disabled:opacity-50"
          >
            {loginLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}

      {adminEnabled && !checking && isSuperadmin && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-muted)]">
            Signed in as <span className="text-white">{username}</span>
          </p>
          <button
            type="button"
            disabled={refreshLoading}
            onClick={handleRefresh}
            className="w-full rounded bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {refreshLoading ? "Refreshing DB…" : "Refresh community DB"}
          </button>
          <p className="text-[10px] text-[var(--color-muted)]">
            Downloads from COMMUNITY_DB_URL / DB_DOWNLOAD_URL and merges into
            SQLITE_PATH (keeps derived tables per IMPORT_KEEP_LOCAL_TABLES).
          </p>
          <button
            type="button"
            disabled={refreshLoading}
            onClick={handleRefreshDungeons}
            className="w-full rounded bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {refreshLoading ? "Working…" : "Check for new dungeons"}
          </button>
          <p className="text-[10px] text-[var(--color-muted)]">
            Scrapes AppMedia ゲリラ/ステージ sidebar; imports post ids newer
            than the latest dungeon seed. Deleted dungeons still listed in
            dungeon-urls.txt can be re-imported.
          </p>
          <button
            type="button"
            disabled={refreshLoading}
            onClick={handleRefreshEvents}
            className="w-full rounded bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {refreshLoading ? "Working…" : "Check for new events"}
          </button>
          <p className="text-[10px] text-[var(--color-muted)]">
            Reads PAD US news for new event names, matches the collab group in
            SQLite, and showcases that whole group. Assist Evolution names keep
            a New Monster / New Evolution badge.
          </p>
          {refreshResult && (
            <p className="text-xs text-emerald-300">{refreshResult}</p>
          )}
          {refreshError && (
            <p className="text-xs text-red-300">{refreshError}</p>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-[var(--color-muted)] underline hover:text-white"
          >
            Sign out
          </button>
        </div>
      )}
    </>
  );

  if (variant === "inline") {
    return (
      <section className="mb-6 rounded-lg border border-amber-800/70 bg-amber-950/25 p-4">
        <h2 className="mb-3 text-sm font-semibold text-amber-200">Superadmin</h2>
        {fields}
      </section>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[#161b22] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-accent)]">
            Superadmin
          </h2>
          <button
            type="button"
            className="text-xs text-[var(--color-muted)] hover:text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {fields}
      </div>
    </div>
  );
}
