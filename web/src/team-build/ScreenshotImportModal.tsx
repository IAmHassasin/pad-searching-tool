import { useQuery } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { fetchMonstersByIds } from "../api";
import { MonsterPortrait } from "../components/MonsterPortrait";
import {
  applyScreenshotSelections,
  type SlotSelection,
} from "../lib/team-build/screenshot/apply";
import {
  cropDataUrl,
  decodeImageFile,
  loadIconIndex,
} from "../lib/team-build/screenshot/browser";
import type { IconCandidate } from "../lib/team-build/screenshot/icon-index";
import {
  assistSuggestions,
  matchScreenshot,
  needsReview,
  preselectedCandidate,
  type ScreenshotMatch,
} from "../lib/team-build/screenshot/match";
import { TEAM_SIZE, type TeamMemberConfig } from "../lib/team-build/types";
import { isNativeApp } from "../lib/app-update/platform";
import { findPdcTeamQr } from "../lib/team-build/pdc-qr-scan";
import type { PdcTeam } from "../lib/team-build/pdc-team-string";
import type { MonsterRecord } from "../types";
import { PdcCameraScanner } from "./PdcCameraScanner";
import { PdcImportPreview } from "./PdcImportPreview";

type Props = {
  open: boolean;
  members: TeamMemberConfig[];
  onApply: (members: TeamMemberConfig[]) => void;
  /** A PDC team QR was found (image or camera) and the user pressed Apply. */
  onApplyPdc: (team: PdcTeam) => void;
  onClose: () => void;
};

/** A monster id, `null` to empty the slot, or "keep" to leave the slot untouched. */
type Pick = number | null | "keep";

type Status =
  | { kind: "idle" }
  | { kind: "working"; step: string }
  | { kind: "ready" }
  | { kind: "error"; message: string };

type Thumbs = { card: string; assist: string | null };

const SLOT_LABELS = ["Leader", "Sub 1", "Sub 2", "Sub 3", "Sub 4", "Helper"];

/** `/monsters/lookup` accepts at most this many ids. */
const LOOKUP_LIMIT = 50;

function keepAll(): Pick[] {
  return Array.from({ length: TEAM_SIZE }, () => "keep" as const);
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function pickLabel(pick: Pick, current: string): string {
  if (pick === "keep") return current ? `keep #${current}` : "keep empty";
  if (pick === null) return "empty";
  return `#${pick}`;
}

function CandidateChip({
  candidate,
  record,
  selected,
  review = false,
  onSelect,
}: {
  candidate: IconCandidate;
  record: MonsterRecord | undefined;
  selected: boolean;
  /** Preselected but not sure: red blinking outline so the user double-checks it. */
  review?: boolean;
  onSelect: () => void;
}) {
  const name = record?.name_en ?? "";
  const label = name ? `#${candidate.id} ${name}` : `#${candidate.id}`;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-review={review || undefined}
      title={review ? `${label} — please double-check this match` : label}
      className={`pressable flex max-w-full items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left ${
        selected
          ? review
            ? "animate-review-blink border-[var(--color-negative)] bg-[var(--color-accent-muted)]"
            : "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)] shadow-[var(--shadow-glow)]"
          : "border-white/[0.06] bg-[var(--color-panel)]/90 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)]"
      }`}
    >
      <MonsterPortrait
        monsterId={candidate.id}
        variant="icon"
        alt=""
        className="h-7 w-7 shrink-0 rounded"
      />
      <span className="flex min-w-0 flex-col">
        <span className="font-mono text-[10px] font-bold tabular-nums text-[var(--color-fg-strong)]">
          #{candidate.id}
          <span className="ml-1 font-normal text-[var(--color-muted)]">
            {Math.round(candidate.score * 100)}%
          </span>
        </span>
        {name && (
          <span className="max-w-[9rem] truncate text-[10px] text-[var(--color-muted)]">
            {name}
          </span>
        )}
      </span>
    </button>
  );
}

function PlainChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`pressable rounded-lg border px-2 py-1 text-[10px] font-semibold ${
        selected
          ? "border-[var(--color-accent)]/70 bg-[var(--color-accent-muted)] text-[var(--color-fg-strong)]"
          : "border-white/[0.06] bg-[var(--color-panel)]/90 text-[var(--color-muted)] hover:border-[var(--color-border-strong)]"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * "Import from screenshot": decodes a PAD Edit Team screenshot in the browser, matches every
 * card icon against the prebuilt icon index and lets the user confirm each slot before the
 * draft is touched.
 */
export function ScreenshotImportModal({ open, members, onApply, onApplyPdc, onClose }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [match, setMatch] = useState<ScreenshotMatch | null>(null);
  const [thumbs, setThumbs] = useState<Thumbs[]>([]);
  const [monsterPicks, setMonsterPicks] = useState<Pick[]>(keepAll);
  const [eqPicks, setEqPicks] = useState<Pick[]>(keepAll);
  /** Team decoded from a PDC QR code; replaces the icon-matching result when set. */
  const [pdcTeam, setPdcTeam] = useState<PdcTeam | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const canUseCamera = isNativeApp();
  /** Bumped on every new image and on reset so a stale run cannot publish its result. */
  const runRef = useRef(0);

  const reset = useCallback(() => {
    runRef.current++;
    setStatus({ kind: "idle" });
    setMatch(null);
    setThumbs([]);
    setMonsterPicks(keepAll());
    setEqPicks(keepAll());
    setPdcTeam(null);
    setCameraOn(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const processFile = useCallback(async (file: Blob) => {
    const run = ++runRef.current;
    setMatch(null);
    setThumbs([]);
    setPdcTeam(null);
    setCameraOn(false);
    setStatus({ kind: "working", step: "Decoding image…" });
    try {
      const indexPromise = loadIconIndex();
      // A PDC image needs no icon index; keep a failed download from being "unhandled".
      indexPromise.catch(() => undefined);
      const img = await decodeImageFile(file);
      if (run !== runRef.current) return;
      // PDC team images carry an exact QR code: prefer it over icon matching.
      setStatus({ kind: "working", step: "Looking for a PDC QR code…" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (run !== runRef.current) return;
      const qr = findPdcTeamQr(img);
      if (qr?.kind === "pdc") {
        setPdcTeam(qr.team);
        setStatus({ kind: "ready" });
        return;
      }
      const index = await indexPromise;
      if (run !== runRef.current) return;
      setStatus({ kind: "working", step: "Matching cards…" });
      // Let the status line paint before the synchronous matching pass.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (run !== runRef.current) return;
      const result = matchScreenshot(img, index);
      if (!result) {
        setStatus({
          kind: "error",
          message:
            "No team row found. Use a full screenshot of the Edit Team screen.",
        });
        return;
      }
      setMatch(result);
      setThumbs(
        result.slots.map((s) => ({
          card: cropDataUrl(img, s.box),
          assist: s.assistBox ? cropDataUrl(img, s.assistBox) : null,
        }))
      );
      setMonsterPicks(
        result.slots.map((s) => preselectedCandidate(s.candidates)?.id ?? "keep")
      );
      setEqPicks(keepAll());
      setStatus({ kind: "ready" });
    } catch (err) {
      if (run !== runRef.current) return;
      setStatus({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Could not read the screenshot.",
      });
    }
  }, []);

  // Ctrl+V / long-press paste while the modal is open.
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find(isImageFile);
      if (file) {
        e.preventDefault();
        void processFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, processFile]);

  // Explicit clipboard read (button) for users who do not know about Ctrl+V.
  const canReadClipboard =
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.read === "function";
  const pasteFromClipboard = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          void processFile(await item.getType(type));
          return;
        }
      }
      setStatus({ kind: "error", message: "No image in the clipboard. Copy a screenshot first." });
    } catch {
      setStatus({
        kind: "error",
        message:
          "Clipboard access was refused. Allow it in the browser, or press Ctrl+V / choose a file.",
      });
    }
  }, [processFile]);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && isImageFile(file)) void processFile(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files).find(isImageFile);
    if (file) void processFile(file);
  };

  const candidateIds = useMemo(() => {
    const ids = new Set<number>();
    for (const m of pdcTeam?.members ?? []) {
      ids.add(m.monsterId);
      if (m.assist) ids.add(m.assist.id);
    }
    for (const slot of match?.slots ?? []) {
      for (const c of slot.candidates) ids.add(c.id);
      for (const c of assistSuggestions(slot.assistCandidates)) ids.add(c.id);
    }
    return [...ids].slice(0, LOOKUP_LIMIT);
  }, [match, pdcTeam]);

  const lookup = useQuery({
    queryKey: ["team-build", "screenshot-candidates", candidateIds],
    queryFn: () => fetchMonstersByIds(candidateIds),
    enabled: candidateIds.length > 0,
  });

  const recordById = useMemo(() => {
    const map = new Map<number, MonsterRecord>();
    for (const row of lookup.data?.rows ?? []) {
      const id = row.monster_id ?? row.__source_pk;
      if (id != null) map.set(Number(id), row);
    }
    return map;
  }, [lookup.data]);

  const changedSlots = useMemo(
    () =>
      monsterPicks.reduce<number>(
        (n, pick, i) => n + (pick !== "keep" || eqPicks[i] !== "keep" ? 1 : 0),
        0
      ),
    [monsterPicks, eqPicks]
  );

  const handleApply = () => {
    if (pdcTeam) {
      onApplyPdc(pdcTeam);
      return;
    }
    if (!match) return;
    const selections: SlotSelection[] = [];
    for (let i = 0; i < TEAM_SIZE; i++) {
      const monster = monsterPicks[i];
      const eq = eqPicks[i];
      if (monster === "keep" && eq === "keep") continue;
      const sel: SlotSelection = { slotIndex: i };
      if (monster !== "keep") sel.monsterId = monster;
      if (eq !== "keep") sel.eqId = eq;
      selections.push(sel);
    }
    onApply(applyScreenshotSelections(members, selections));
  };

  const setMonsterPick = (i: number, pick: Pick) =>
    setMonsterPicks((p) => p.map((v, j) => (j === i ? pick : v)));
  const setEqPick = (i: number, pick: Pick) =>
    setEqPicks((p) => p.map((v, j) => (j === i ? pick : v)));

  if (!open) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-3"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Import team from screenshot"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="ds-float animate-sheet-in flex max-h-[88vh] w-full max-w-2xl flex-col rounded-t-3xl pb-[env(safe-area-inset-bottom)] sm:animate-none sm:rounded-2xl sm:pb-0"
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-2">
          <h2 className="text-sm font-bold text-[var(--color-fg-strong)]">
            Import from screenshot
          </h2>
          {pdcTeam ? (
            <span className="rounded-full border border-[var(--color-positive)]/40 bg-[var(--color-positive)]/10 px-1.5 py-px font-mono text-[9px] font-bold text-emerald-300">
              PDC QR
            </span>
          ) : match ? (
            <span className="rounded-full border border-[var(--color-secondary)]/40 bg-[var(--color-secondary-muted)] px-1.5 py-px font-mono text-[9px] font-bold tabular-nums text-[var(--color-secondary-strong)]">
              row match {Math.round(match.score * 100)}%
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="pressable ml-auto flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-sm leading-none text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-fg-strong)]"
          >
            ×
          </button>
        </header>

        <div className="shrink-0 space-y-2 px-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="ds-btn-primary pressable inline-flex min-h-9 cursor-pointer items-center px-3 text-xs">
              Choose image…
              <input
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="sr-only"
              />
            </label>
            {canReadClipboard && (
              <button
                type="button"
                className="ds-btn pressable min-h-9 px-3 text-xs"
                onClick={() => void pasteFromClipboard()}
                title="Read the image currently in the clipboard (Ctrl+V works too)"
              >
                Paste from clipboard
              </button>
            )}
            {canUseCamera && (
              <button
                type="button"
                className="ds-btn pressable min-h-9 px-3 text-xs"
                aria-pressed={cameraOn}
                onClick={() => {
                  runRef.current++;
                  setMatch(null);
                  setPdcTeam(null);
                  setStatus({ kind: "idle" });
                  setCameraOn((on) => !on);
                }}
                title="Scan the QR code of a PDC team image with the camera"
              >
                {cameraOn ? "Stop camera" : "Scan PDC QR"}
              </button>
            )}
            <span className="text-[10px] text-[var(--color-muted)]">
              Edit Team screen (EN client) or a PDC team image (its QR is read exactly).
              Drop, paste (Ctrl+V) or choose a screenshot. Matches below 90% blink red:
              double-check them. Nothing changes until you press Apply.
            </span>
          </div>
          {status.kind === "working" && (
            <p className="text-[10px] text-[var(--color-amber-text)]">{status.step}</p>
          )}
          {status.kind === "error" && (
            <p role="alert" className="text-[10px] text-red-300">
              {status.message}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {cameraOn ? (
            <PdcCameraScanner
              onFound={(result) => {
                setCameraOn(false);
                setPdcTeam(result.team);
                setStatus({ kind: "ready" });
              }}
              onCancel={() => setCameraOn(false)}
            />
          ) : pdcTeam ? (
            <PdcImportPreview team={pdcTeam} recordById={recordById} />
          ) : match ? (
            <ul className="space-y-2">
              {match.slots.map((slot, i) => {
                const current = members[i];
                const assists = assistSuggestions(slot.assistCandidates);
                const preselected = preselectedCandidate(slot.candidates);
                return (
                  <li
                    key={slot.slotIndex}
                    className="ds-card flex gap-2 p-2"
                  >
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      <span className="ds-label">{SLOT_LABELS[i]}</span>
                      <img
                        src={thumbs[i]?.card}
                        alt={`${SLOT_LABELS[i]} crop`}
                        className="h-12 w-12 rounded border border-white/10"
                      />
                      {thumbs[i]?.assist && (
                        <img
                          src={thumbs[i]?.assist ?? undefined}
                          alt={`${SLOT_LABELS[i]} assist crop`}
                          className="h-7 w-7 rounded border border-white/10"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {slot.candidates.map((c) => (
                          <CandidateChip
                            key={c.id}
                            candidate={c}
                            record={recordById.get(c.id)}
                            selected={monsterPicks[i] === c.id}
                            review={
                              monsterPicks[i] === c.id &&
                              preselected?.id === c.id &&
                              needsReview(c)
                            }
                            onSelect={() => setMonsterPick(i, c.id)}
                          />
                        ))}
                        <PlainChip
                          label={pickLabel("keep", current?.monsterId ?? "")}
                          selected={monsterPicks[i] === "keep"}
                          onSelect={() => setMonsterPick(i, "keep")}
                        />
                        <PlainChip
                          label="empty"
                          selected={monsterPicks[i] === null}
                          onSelect={() => setMonsterPick(i, null)}
                        />
                      </div>
                      {slot.assistBox && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-[var(--color-muted)]">
                            Assist
                          </span>
                          {assists.map((c) => (
                            <CandidateChip
                              key={c.id}
                              candidate={c}
                              record={recordById.get(c.id)}
                              selected={eqPicks[i] === c.id}
                              onSelect={() => setEqPick(i, c.id)}
                            />
                          ))}
                          {assists.length === 0 && (
                            <span className="text-[10px] text-[var(--color-faint)]">
                              no confident match
                            </span>
                          )}
                          <PlainChip
                            label={pickLabel("keep", current?.eqId ?? "")}
                            selected={eqPicks[i] === "keep"}
                            onSelect={() => setEqPick(i, "keep")}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-[11px] text-[var(--color-faint)]">
              {status.kind === "working"
                ? status.step
                : "Pick a screenshot to see the detected cards."}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-white/[0.06] px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="ds-btn pressable min-h-9 px-3 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={pdcTeam == null && (!match || changedSlots === 0)}
            className="ds-btn-primary pressable min-h-9 px-4 text-xs disabled:cursor-not-allowed"
          >
            {pdcTeam ? "Apply PDC team" : `Apply ${changedSlots > 0 ? `(${changedSlots} slots)` : ""}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
