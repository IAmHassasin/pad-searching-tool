import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ArtCropModal, applyArtCropFromUrl } from "./ArtCropModal";
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
  type ArtCropRect,
  type CustomCardDraft,
  type IconCropRect,
} from "./types";

function revokeUrl(url: string | null | undefined) {
  if (url) URL.revokeObjectURL(url);
}

export function CustomCardPage() {
  const [draft, setDraft] = useState<CustomCardDraft>(() => createEmptyDraft());
  const [artError, setArtError] = useState<string | null>(null);
  const [artCropOpen, setArtCropOpen] = useState(false);
  const [iconCropOpen, setIconCropOpen] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const patch = useCallback((partial: Partial<CustomCardDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    return () => {
      revokeUrl(draft.sourceArtObjectUrl);
      revokeUrl(draft.artObjectUrl);
      revokeUrl(draft.iconObjectUrl);
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
    const sourceUrl = URL.createObjectURL(file);
    setDraft((prev) => {
      revokeUrl(prev.sourceArtObjectUrl);
      revokeUrl(prev.artObjectUrl);
      revokeUrl(prev.iconObjectUrl);
      return {
        ...prev,
        sourceArtBlob: file,
        sourceArtObjectUrl: sourceUrl,
        artBlob: null,
        artObjectUrl: null,
        artCrop: null,
        iconBlob: null,
        iconObjectUrl: null,
        iconCrop: null,
      };
    });
    setArtCropOpen(true);
    // Bake a default 2:3 crop so preview isn't empty while the modal is open.
    void applyArtCropFromUrl(sourceUrl, null)
      .then(({ crop, blob }) => {
        setDraft((prev) => {
          if (prev.sourceArtObjectUrl !== sourceUrl) return prev;
          revokeUrl(prev.artObjectUrl);
          return {
            ...prev,
            artBlob: blob,
            artObjectUrl: URL.createObjectURL(blob),
            artCrop: crop,
          };
        });
      })
      .catch(() => {
        setArtError("Could not prepare art crop.");
      });
  }, []);

  const clearArt = useCallback(() => {
    setArtError(null);
    setArtCropOpen(false);
    setIconCropOpen(false);
    setDraft((prev) => {
      revokeUrl(prev.sourceArtObjectUrl);
      revokeUrl(prev.artObjectUrl);
      revokeUrl(prev.iconObjectUrl);
      return {
        ...prev,
        sourceArtBlob: null,
        sourceArtObjectUrl: null,
        artBlob: null,
        artObjectUrl: null,
        artCrop: null,
        iconBlob: null,
        iconObjectUrl: null,
        iconCrop: null,
      };
    });
  }, []);

  const applyArtCrop = useCallback((crop: ArtCropRect, artBlob: Blob) => {
    setDraft((prev) => {
      revokeUrl(prev.artObjectUrl);
      return {
        ...prev,
        artBlob,
        artObjectUrl: URL.createObjectURL(artBlob),
        artCrop: crop,
      };
    });
    setArtCropOpen(false);
  }, []);

  const applyIconCrop = useCallback((crop: IconCropRect, iconBlob: Blob) => {
    setDraft((prev) => {
      revokeUrl(prev.iconObjectUrl);
      return {
        ...prev,
        iconBlob,
        iconObjectUrl: URL.createObjectURL(iconBlob),
        iconCrop: crop,
      };
    });
    setIconCropOpen(false);
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
    <div className="flex min-h-full flex-col bg-[var(--color-surface)] text-[var(--color-fg)]">
      <PageHeader
        title="Custom Card"
        subtitle="Build a PAD-style detail card and download as PNG"
        maxWidthClass="max-w-7xl"
        actions={
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={exporting}
            className="ds-btn-primary pressable min-h-9 px-3 text-sm whitespace-nowrap disabled:cursor-not-allowed"
          >
            {exporting ? "Exporting…" : "Download PNG"}
          </button>
        }
      >
        {exportMsg && (
          <p
            className="font-mono text-xs text-[var(--color-muted)]"
            role="status"
          >
            {exportMsg}
          </p>
        )}
      </PageHeader>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-3 sm:p-4 lg:grid-cols-2">
        <div className="min-h-0 overflow-auto rounded-xl border border-white/[0.06] bg-[var(--color-inset)] p-4">
          <CustomCardPreview ref={previewRef} draft={draft} />
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-auto pb-8">
          <ArtUploadPanel
            artObjectUrl={draft.artObjectUrl}
            sourceArtObjectUrl={draft.sourceArtObjectUrl}
            error={artError}
            onArtSelected={replaceArt}
            onClearArt={clearArt}
            onOpenArtCrop={() => setArtCropOpen(true)}
            onOpenIconCrop={() => setIconCropOpen(true)}
            hasArtCrop={Boolean(draft.artCrop)}
            hasIcon={Boolean(draft.iconObjectUrl)}
          />
          <IdentityEditor draft={draft} onChange={patch} />
          <AttributeTypeEditor draft={draft} onChange={patch} />
          <AwakeningEditor draft={draft} onChange={patch} />
          <SkillEditor draft={draft} onChange={patch} />
          <StatsEditor draft={draft} onChange={patch} />
        </div>
      </div>

      {draft.sourceArtObjectUrl && (
        <ArtCropModal
          open={artCropOpen}
          imageUrl={draft.sourceArtObjectUrl}
          initialCrop={draft.artCrop}
          onCancel={() => setArtCropOpen(false)}
          onConfirm={applyArtCrop}
        />
      )}
      {draft.sourceArtObjectUrl && (
        <IconCropModal
          open={iconCropOpen}
          imageUrl={draft.sourceArtObjectUrl}
          initialCrop={draft.iconCrop}
          onCancel={() => setIconCropOpen(false)}
          onConfirm={applyIconCrop}
        />
      )}
    </div>
  );
}
