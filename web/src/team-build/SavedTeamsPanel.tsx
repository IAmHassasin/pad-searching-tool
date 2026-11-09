import { useEffect, useState } from "react";
import { MonsterPortrait } from "../components/MonsterPortrait";
import {
  deleteSavedTeam,
  findSavedTeamByName,
  loadSavedTeams,
  MAX_SAVED_TEAMS,
  MAX_TEAM_NAME_LENGTH,
  saveTeam,
  subscribeSavedTeams,
  type SavedTeam,
} from "../lib/team-build/saved-teams-storage";
import type { TeamBuildConfig } from "../lib/team-build/types";
import type { MonsterRecord } from "../types";

type Props = {
  config: TeamBuildConfig;
  monstersById: Map<number, MonsterRecord>;
  /** Replace the working team with a saved one. */
  onLoad: (team: SavedTeam) => void;
};

const SAVE_ERRORS: Record<"empty-name" | "limit" | "storage", string> = {
  "empty-name": "Enter a name first.",
  limit: `At most ${MAX_SAVED_TEAMS} saved teams — delete one first.`,
  storage: "Could not write to browser storage (full or blocked).",
};

function suggestedName(config: TeamBuildConfig, monstersById: Map<number, MonsterRecord>): string {
  const leaderId = Number(config.members[0]?.monsterId);
  const leader = Number.isFinite(leaderId) && leaderId > 0 ? monstersById.get(leaderId) : null;
  return leader?.name_en?.trim() || (leaderId > 0 ? `Team #${leaderId}` : "");
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

/**
 * Named teams kept in this browser's localStorage: save the current team, load one back
 * (replaces the working team) or delete one (two clicks).
 */
export function SavedTeamsPanel({ config, monstersById, onLoad }: Props) {
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<SavedTeam[]>(() => loadSavedTeams());
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  /** Id of the saved team the next Save click will overwrite (asked once). */
  const [confirmOverwriteId, setConfirmOverwriteId] = useState<string | null>(null);

  useEffect(() => subscribeSavedTeams(setTeams), []);
  // Pending confirmations expire (iOS buttons never blur, so blur alone is not enough).
  useEffect(() => {
    if (!confirmDeleteId && !confirmOverwriteId) return;
    const t = window.setTimeout(() => {
      setConfirmDeleteId(null);
      setConfirmOverwriteId(null);
    }, 4000);
    return () => window.clearTimeout(t);
  }, [confirmDeleteId, confirmOverwriteId]);
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, [message]);

  const hasCards = config.members.some((m) => m.monsterId.trim() !== "");
  const placeholder = suggestedName(config, monstersById) || "Team name";

  const saveName = name.trim() || placeholder;
  const overwriteTarget = findSavedTeamByName(teams, saveName);
  const confirmingOverwrite =
    overwriteTarget != null && confirmOverwriteId === overwriteTarget.id;

  const handleSave = () => {
    // Same name replaces a saved team — ask once first (the default name is the leader's,
    // so two teams with one leader would otherwise overwrite each other silently).
    if (overwriteTarget && !confirmingOverwrite) {
      setConfirmOverwriteId(overwriteTarget.id);
      return;
    }
    setConfirmOverwriteId(null);
    const res = saveTeam(saveName, config);
    setTeams(res.teams);
    if (!res.ok) {
      setMessage({ text: SAVE_ERRORS[res.error], error: true });
      return;
    }
    setName("");
    setMessage({ text: res.replaced ? `Updated “${res.team.name}”.` : `Saved “${res.team.name}”.` });
  };

  const handleDelete = (team: SavedTeam) => {
    if (confirmDeleteId !== team.id) {
      setConfirmDeleteId(team.id);
      return;
    }
    const res = deleteSavedTeam(team.id);
    setTeams(res.teams);
    setConfirmDeleteId(null);
    setMessage(
      res.ok
        ? { text: `Deleted “${team.name}”.` }
        : { text: "Could not delete (storage blocked?).", error: true }
    );
  };

  return (
    <section className="ds-card mb-3 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <span
          aria-hidden
          className={`text-xs text-[var(--color-accent)] transition-transform ${open ? "" : "-rotate-90"}`}
        >
          ▾
        </span>
        <h2 className="ds-label">Saved teams · this browser</h2>
        <span className="font-mono text-[10px] tabular-nums text-[var(--color-faint)]">
          {teams.length}
        </span>
      </button>
      <p
        role="status"
        className={`truncate text-[10px] font-semibold empty:hidden ${
          message?.error ? "text-[var(--color-negative)]" : "text-[var(--color-positive)]"
        }`}
      >
        {message?.text ?? ""}
      </p>

      {open && (
        <div className="mt-3 space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <input
              type="text"
              value={name}
              maxLength={MAX_TEAM_NAME_LENGTH}
              onChange={(e) => {
                setName(e.target.value);
                setConfirmOverwriteId(null);
              }}
              placeholder={placeholder}
              aria-label="Team name"
              className="ds-input min-h-9 min-w-0 flex-1 px-2 py-1 text-xs"
            />
            <button
              type="submit"
              disabled={!hasCards}
              title={
                hasCards
                  ? "Save the current team (a team with the same name is replaced)"
                  : "Add a card first"
              }
              className={`pressable min-h-9 px-4 text-xs font-semibold disabled:opacity-40 ${
                confirmingOverwrite
                  ? "rounded-lg bg-[var(--color-negative)]/20 text-[var(--color-negative)]"
                  : "ds-btn-primary"
              }`}
            >
              {confirmingOverwrite ? `Overwrite “${overwriteTarget?.name}”?` : "Save current team"}
            </button>
          </form>

          {teams.length === 0 ? (
            <p className="text-[10px] text-[var(--color-muted)]">
              No saved teams yet. Saved teams stay in this browser only.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {teams.map((team) => {
                const confirming = confirmDeleteId === team.id;
                return (
                  <li
                    key={team.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-[var(--color-inset)]/60 px-2 py-1.5"
                  >
                    <div className="flex shrink-0 gap-0.5" aria-hidden>
                      {team.config.members.map((m, i) => {
                        const id = Number(m.monsterId);
                        return id > 0 ? (
                          <MonsterPortrait
                            key={i}
                            monsterId={id}
                            alt=""
                            variant="icon"
                            className="h-7 w-7 rounded border border-white/10 object-cover"
                          />
                        ) : (
                          <span key={i} className="h-7 w-7 rounded border border-dashed border-white/10" />
                        );
                      })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[var(--color-fg-strong)]">
                        {team.name}
                      </p>
                      <p className="font-mono text-[9px] text-[var(--color-faint)]">
                        {formatSavedAt(team.savedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteId(null);
                        onLoad(team);
                        setMessage({ text: `Loaded “${team.name}”.` });
                      }}
                      title="Replace the current team with this one"
                      className="ds-btn pressable min-h-8 px-3 text-xs font-semibold"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(team)}
                      onBlur={() => confirming && setConfirmDeleteId(null)}
                      aria-label={confirming ? `Confirm delete ${team.name}` : `Delete ${team.name}`}
                      className={`pressable min-h-8 rounded-lg px-3 text-xs font-semibold ${
                        confirming
                          ? "bg-[var(--color-negative)]/20 text-[var(--color-negative)]"
                          : "bg-white/5 text-[var(--color-muted)] hover:text-[var(--color-negative)]"
                      }`}
                    >
                      {confirming ? "Confirm delete" : "Delete"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
