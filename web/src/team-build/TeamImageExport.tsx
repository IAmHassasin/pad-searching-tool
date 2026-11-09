import { useEffect, useRef, useState } from "react";
import { isClipboardImageSupported } from "../lib/copy-element-image";
import type { TeamImageLayout } from "../lib/team-build/team-image-layout";
import { renderTeamImageBlob } from "../lib/team-build/team-image-render";

type Status = { kind: "idle" } | { kind: "ok"; text: string } | { kind: "error"; text: string };
const FEEDBACK_MS = 2500;

/**
 * Preview + PNG download / clipboard copy of the team image (Tsubaki `^buildimg` style).
 * The preview re-renders when the layout changes; copy/download render fresh so the output
 * always matches the current team.
 */
export function TeamImageExport({ layout, fileName }: { layout: TeamImageLayout; fileName: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const resetTimer = useRef<number | null>(null);
  const clipboardSupported = isClipboardImageSupported();
  const hasCard = layout.slots.some((s) => s.card != null);

  useEffect(() => {
    if (!hasCard) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    renderTeamImageBlob(layout)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : "Could not render the team image");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [layout, hasCard]);

  useEffect(
    () => () => {
      if (resetTimer.current != null) window.clearTimeout(resetTimer.current);
    },
    []
  );

  const flash = (next: Status) => {
    setStatus(next);
    if (resetTimer.current != null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus({ kind: "idle" }), FEEDBACK_MS);
  };

  const handleDownload = async () => {
    try {
      const blob = await renderTeamImageBlob(layout);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
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
      await navigator.clipboard.write([new ClipboardItem({ "image/png": renderTeamImageBlob(layout) })]);
      flash({ kind: "ok", text: "Copied" });
    } catch (err) {
      flash({ kind: "error", text: err instanceof Error ? err.message : "Copy failed" });
    }
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="ds-label text-[var(--color-faint)]">Team image</span>
        <div className="flex items-center gap-2">
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
            title={clipboardSupported ? "Copy the team image to the clipboard" : "Image clipboard is not supported in this browser"}
            className="ds-btn pressable min-h-8 px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Copy image
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={!hasCard}
            className="ds-btn pressable min-h-8 px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download PNG
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg bg-[var(--color-inset)] p-2 ring-1 ring-white/[0.04]">
        {!hasCard ? (
          <p className="text-[11px] text-[var(--color-faint)]">Add a card to build the team image.</p>
        ) : previewError ? (
          <p className="text-[11px] text-red-300">{previewError}</p>
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt="Team image preview"
            width={layout.width}
            height={layout.height}
            className="block h-auto max-w-full"
          />
        ) : (
          <p className="text-[11px] text-[var(--color-faint)]">Rendering…</p>
        )}
      </div>
    </div>
  );
}
