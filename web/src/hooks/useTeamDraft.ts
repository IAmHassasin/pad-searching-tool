import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearDraftMembers,
  loadTeamDraft,
  saveTeamDraft,
  setDraftSlot,
  subscribeTeamDraft,
  type TeamDraftSlotKind,
} from "../lib/team-build/team-draft-storage";
import {
  defaultTeamBuildConfig,
  type TeamBuildConfig,
} from "../lib/team-build/types";

const SAVE_DEBOUNCE_MS = 200;

/**
 * Team build config persisted to localStorage so the search page and the team
 * build page (separate full-page routes) share the same draft.
 */
export function useTeamDraft() {
  const [draft, setDraftState] = useState<TeamBuildConfig>(
    () => loadTeamDraft() ?? defaultTeamBuildConfig()
  );
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // Persist (debounced) after every local change.
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      saveTeamDraft(draft);
      dirtyRef.current = false;
      timerRef.current = null;
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [draft]);

  // Flush a pending save when the page is being left.
  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current) {
        saveTeamDraft(draft);
        dirtyRef.current = false;
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [draft]);

  // Another tab / page wrote the draft.
  useEffect(
    () =>
      subscribeTeamDraft((next) => {
        if (next) {
          dirtyRef.current = false;
          setDraftState(next);
        }
      }),
    []
  );

  const setDraft = useCallback(
    (update: TeamBuildConfig | ((prev: TeamBuildConfig) => TeamBuildConfig)) => {
      dirtyRef.current = true;
      setDraftState((prev) =>
        typeof update === "function" ? update(prev) : update
      );
    },
    []
  );

  const setSlot = useCallback(
    (slotIndex: number, kind: TeamDraftSlotKind, monsterId: number | null) => {
      setDraft((prev) => setDraftSlot(prev, slotIndex, kind, monsterId));
    },
    [setDraft]
  );

  const clearMembers = useCallback(() => {
    setDraft((prev) => clearDraftMembers(prev));
  }, [setDraft]);

  return { draft, setDraft, setSlot, clearMembers };
}
