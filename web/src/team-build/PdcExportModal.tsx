import { useEffect, useMemo, useRef, useState } from "react";
import { isClipboardImageSupported } from "../lib/copy-element-image";
import {
  PDC_MEMO_MAX_LENGTH,
  PDC_TITLE_MAX_LENGTH,
  buildPdcImage,
} from "../lib/team-build/pdc-image";
import { renderPdcImageBlob } from "../lib/team-build/pdc-image-render";
import type { PdcTeam } from "../lib/team-build/pdc-team-string";
import type { TeamBuildConfig } from "../lib/team-build/types";
import type { MonsterRecord } from "../types";

type Props = {
  open: boolean;
  config: TeamBuildConfig;
  monstersById: ReadonlyMap<number, MonsterRecord>;
  /** Team last imported from a PDC QR; keeps its latents / assist levels in the export. */
  previous?: PdcTeam | null;
  title: string;
  memo: string;
  onTitleChange: (value: string) => void;
  onMemoChange: (value: string) => void;
  onClose: () => void;
};

type Status = { kind: "idle" } | { kind: "ok"; text: string } | { kind: "error"; text: string };

const FEEDBACK_MS = 2500;
/** Typing in title / memo re-renders after this pause. */
const RENDER_DEBOUNCE_MS = 250;
const FILE_NAME = "pdc-team.png";

/**
 * "Export as PDC": preview of a PDC-style team image whose QR code PDC (パズドラダメージ計算)
 * can scan, with title / memo inputs, PNG download and clipboard copy.
 */
export function PdcExportModal({
  open,
  config,
  monstersById,
  previous,
  title,
  memo,
  onTitleChange,
  onMemoChange,
  onClose,
}: Props) {
  // Built only while open, and never thrown into the page: a bad value must not blank Team Build.
  const built = useMemo(() => {
    if (!open) return null;
    try {
      return { ...buildPdcImage(config, monstersById, { title, memo }, previous ?? undefined), error: null };
    } catch (err) {
      return { model: null, warnings: [], error: err instanceof Error ? err.message : "Could not build the PDC QR" };
    }
  }, [open, config, monstersById, previous, title, memo]);
  const model = built?.model ?? null;
  const warnings = built?.warnings ?? [];
  const buildError = built?.error ?? null;
  const hasCard = model != null && model.slots.some((s) => s.card != null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const resetTimer = useRef<number | null>(null);
  const clipboardSupported = isClipboardImageSupported();

  useEffect(() => {
    if (!model || !hasCard) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    const timer = window.setTimeout(() => {
      renderPdcImageBlob(model)
        .then((blob) => {
          if (cancelled) return;
          url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          setPreviewError(null);
        })
        .catch((err: unknown) => {
          if (!cancelled) setPreviewError(err instanceof Error ? err.message : "Could not render the PDC image");
        });
    }, RENDER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [model, hasCard]);

  useEffect(
    () => () => {
      if (resetTimer.current != null) window.clearTimeout(resetTimer.current);
    },
    []
  );

  if (!open) return null;

  const renderModel = () => {
    if (!model) throw new Error(buildError ?? "Nothing to export");
    return renderPdcImageBlob(model);
  };

  const flash = (next: Status) => {
    setStatus(next);
    if (resetTimer.current != null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus({ kind: "idle" }), FEEDBACK_MS);
  };

  const handleDownload = async () => {
    try {
      const blob = await renderModel();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = FILE_NAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash({ kind: "ok", text: "Downloaded" });
    } catch (err) {
      flash({ kind: "error", text: err instanceof Error ? err.message : "Download failed" });
    }
  };

  const handleCopy = async () => {
    try {
      // Passing the promise keeps the clipboard write inside the user gesture (Safari).
      await navigator.clipboard.write([new ClipboardItem({ "image/png": renderModel() })]);
      flash({ kind: "ok", text: "Copied" });
    } catch (err) {
      flash({ kind: "error", text: err instanceof Error ? err.message : "Copy failed" });
    }
  };

  const actionClass =
    "ds-btn pressable min-h-8 px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-3"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Export as PDC"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="ds-float animate-sheet-in flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-3xl pb-[env(safe-area-inset-bottom)] sm:animate-none sm:rounded-2xl sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.06] px-3 py-2">
          <h2 className="text-sm font-bold text-[var(--color-fg-strong)]">Export as PDC</h2>
          <div className="ml-auto flex items-center gap-2">
            {status.kind !== "idle" && (
              <span
                aria-live="polite"
                className={`text-[10px] font-semibold ${
                  status.kind === "ok" ? "text-[var(--color-positive)]" : "text-red-300"
                }`}
              >
                {status.text}
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!hasCard || !clipboardSupported}
              title={clipboardSupported ? "Copy the image to the clipboard" : "Image clipboard is not supported in this browser"}
              className={actionClass}
            >
              Copy to clipboard
            </button>
            <button type="button" onClick={() => void handleDownload()} disabled={!hasCard} className={actionClass}>
              Download PNG
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="pressable flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-sm leading-none text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-fg-strong)]"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
            <label className="flex flex-col gap-1">
              <span className="ds-label text-[var(--color-faint)]">Team name</span>
              <input
                type="text"
                value={title}
                maxLength={PDC_TITLE_MAX_LENGTH}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Title"
                className="ds-input min-h-9 px-2 text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="ds-label text-[var(--color-faint)]">Memo</span>
              <textarea
                value={memo}
                maxLength={PDC_MEMO_MAX_LENGTH}
                onChange={(e) => onMemoChange(e.target.value)}
                rows={2}
                placeholder="Memo"
                className="ds-input min-h-9 resize-y px-2 py-1.5 text-xs"
              />
            </label>
          </div>

          {warnings.length > 0 && (
            <ul className="space-y-0.5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-2 py-1.5 text-[10px] text-amber-200">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          <div className="rounded-lg bg-[var(--color-inset)] p-2 ring-1 ring-white/[0.04]">
            {buildError ? (
              <p className="text-[11px] text-red-300">{buildError}</p>
            ) : !hasCard ? (
              <p className="text-[11px] text-[var(--color-faint)]">Add a card to build the PDC image.</p>
            ) : previewError ? (
              <p className="text-[11px] text-red-300">{previewError}</p>
            ) : previewUrl ? (
              <img src={previewUrl} alt="PDC team image preview" className="block h-auto w-full rounded" />
            ) : (
              <p className="text-[11px] text-[var(--color-faint)]">Rendering…</p>
            )}
          </div>
          <p className="text-[10px] text-[var(--color-muted)]">
            Scan the QR code in PDC to load the team. Team name and memo are only drawn on the image — PDC
            does not read them from the QR. Latent awakenings are not exported.
          </p>
        </div>
      </div>
    </div>
  );
}
