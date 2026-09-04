import { useCallback, useEffect, useRef, useState } from "react";
import { AppToolsNav } from "../components/AppToolsNav";
import { ArtUploadPanel } from "./ArtUploadPanel";
import { AttributeTypeEditor } from "./AttributeTypeEditor";
import { AwakeningEditor } from "./AwakeningEditor";
import { CustomCardPreview } from "./CustomCardPreview";
import { IdentityEditor } from "./IdentityEditor";
import { IconCropModal } from "./IconCropModal";
import { SkillEditor } from "./SkillEditor";
import { StatsEditor } from "./StatsEditor";
import { buildExportFilename, exportElementToPng } from "./export-png";
import {
  createEmptyDraft,
  MAX_ART_BYTES,
  type CustomCardDraft,
  type IconCropRect,
} from "./types";

export function CustomCardPage() {
  const [draft, setDraft] = useState<CustomCardDraft>(() => createEmptyDraft());
  const [artError, setArtError] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const patch = useCallback((partial: Partial<CustomCardDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    return () => {
      if (draft.artObjectUrl) URL.revokeObjectURL(draft.artObjectUrl);
      if (draft.iconObjectUrl) URL.revokeObjectURL(draft.iconObjectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
  }, []);

  const replaceArt = useCallback((file: File) => {
    if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
      setArtError("Only PNG images are supported.");
      return;
    }
    if (file.size > MAX_ART_BYTES) {
      setArtError("Image is too large (max 8 MB).");
      return;
    }
    setArtError(null);
    setDraft((prev) => {
      if (prev.artObjectUrl) URL.revokeObjectURL(prev.artObjectUrl);
      if (prev.iconObjectUrl) URL.revokeObjectURL(prev.iconObjectUrl);
      return {
        ...prev,
        artBlob: file,
        artObjectUrl: URL.createObjectURL(file),
        iconBlob: null,
        iconObjectUrl: null,
        iconCrop: null,
      };
    });
  }, []);

  const clearArt = useCallback(() => {
    setArtError(null);
    setDraft((prev) => {
      if (prev.artObjectUrl) URL.revokeObjectURL(prev.artObjectUrl);
      if (prev.iconObjectUrl) URL.revokeObjectURL(prev.iconObjectUrl);
      return {
        ...prev,
        artBlob: null,
        artObjectUrl: null,
        iconBlob: null,
        iconObjectUrl: null,
        iconCrop: null,
      };
    });
  }, []);

  const applyCrop = useCallback((crop: IconCropRect, iconBlob: Blob) => {
    setDraft((prev) => {
      if (prev.iconObjectUrl) URL.revokeObjectURL(prev.iconObjectUrl);
      return {
        ...prev,
        iconBlob,
        iconObjectUrl: URL.createObjectURL(iconBlob),
        iconCrop: crop,
      };
    });
    setCropOpen(false);
  }, []);

  const handleDownload = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    setExporting(true);
    setExportMsg(null);
    try {
      await exportElementToPng(
        el,
        buildExportFilename(draft.number, draft.name)
      );
      setExportMsg("Downloaded PNG.");
    } catch (err) {
      setExportMsg(
        err instanceof Error
          ? err.message
          : "Export failed — try again after images load"
      );
    } finally {
      setExporting(false);
    }
  }, [draft.name, draft.number]);

  return (
    <div className="flex min-h-full flex-col bg-[var(--color-surface)] text-[#e6edf3]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Custom Card</h1>
            <p className="text-sm text-[var(--color-muted)]">
              Build a PAD-style detail card and download as PNG
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={exporting}
              className="rounded-lg border border-[#c9a84a] bg-[#3a2f12] px-3 py-1.5 text-sm font-semibold text-[#f5e6c8] hover:border-[#ffd54f] disabled:opacity-50"
            >
              {exporting ? "Exporting…" : "Download PNG"}
            </button>
            <AppToolsNav variant="inline" />
          </div>
        </div>
        {exportMsg && (
          <p className="mx-auto mt-2 max-w-7xl text-xs text-[var(--color-muted)]">
            {exportMsg}
          </p>
        )}
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 lg:grid-cols-2">
        <div className="min-h-0 overflow-auto rounded-xl border border-[var(--color-border)] bg-[#0a0e12] p-4">
          <CustomCardPreview ref={previewRef} draft={draft} />
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-auto pb-8">
          <ArtUploadPanel
            artObjectUrl={draft.artObjectUrl}
            error={artError}
            onArtSelected={replaceArt}
            onClearArt={clearArt}
            onOpenCrop={() => setCropOpen(true)}
            hasIcon={Boolean(draft.iconObjectUrl)}
          />
          <IdentityEditor draft={draft} onChange={patch} />
          <AttributeTypeEditor draft={draft} onChange={patch} />
          <AwakeningEditor draft={draft} onChange={patch} />
          <SkillEditor draft={draft} onChange={patch} />
          <StatsEditor draft={draft} onChange={patch} />
        </div>
      </div>

      {draft.artObjectUrl && (
        <IconCropModal
          open={cropOpen}
          imageUrl={draft.artObjectUrl}
          initialCrop={draft.iconCrop}
          onCancel={() => setCropOpen(false)}
          onConfirm={applyCrop}
        />
      )}
    </div>
  );
}
