import { useRef, useState } from "react";

type Props = {
  /** Cropped card art (preferred preview). */
  artObjectUrl: string | null;
  /** Raw upload — enables crop actions. */
  sourceArtObjectUrl: string | null;
  error: string | null;
  onArtSelected: (file: File) => void;
  onClearArt: () => void;
  onOpenArtCrop: () => void;
  onOpenIconCrop: () => void;
  hasArtCrop: boolean;
  hasIcon: boolean;
};

export function ArtUploadPanel({
  artObjectUrl,
  sourceArtObjectUrl,
  error,
  onArtSelected,
  onClearArt,
  onOpenArtCrop,
  onOpenIconCrop,
  hasArtCrop,
  hasIcon,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const previewUrl = artObjectUrl ?? sourceArtObjectUrl;

  const takeFile = (file: File | undefined | null) => {
    if (!file) return;
    onArtSelected(file);
  };

  return (
    <section className="ds-card p-3">
      <h2 className="ds-label mb-2">Art &amp; icon</h2>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          takeFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-center transition-colors ${
          dragOver
            ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)]"
            : "border-[var(--color-border-strong)] bg-[var(--color-inset)]"
        }`}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Card art"
            className="max-h-48 w-auto rounded-lg object-contain ring-1 ring-white/10"
          />
        ) : (
          <p className="text-xs text-[var(--color-muted)]">
            Drop a PNG here or choose a file
          </p>
        )}
        <p className="max-w-xs text-[10px] text-[var(--color-muted)]">
          Art is cropped to a fixed 2:3 portrait frame for the card. Icon is a
          separate 1:1 crop from the original upload.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`pressable min-h-9 px-3 text-xs ${
              sourceArtObjectUrl ? "ds-btn" : "ds-btn-primary"
            }`}
          >
            {sourceArtObjectUrl ? "Replace PNG" : "Upload PNG"}
          </button>
          {sourceArtObjectUrl && (
            <>
              <button
                type="button"
                onClick={onOpenArtCrop}
                className="ds-btn pressable min-h-9 px-3 text-xs font-semibold"
              >
                {hasArtCrop ? "Recrop art" : "Crop art"}
              </button>
              <button
                type="button"
                onClick={onOpenIconCrop}
                className="ds-btn pressable min-h-9 px-3 text-xs font-semibold"
              >
                {hasIcon ? "Recrop icon" : "Crop icon"}
              </button>
              <button
                type="button"
                onClick={onClearArt}
                className="pressable min-h-9 rounded-lg border border-[var(--color-negative)]/40 bg-[var(--color-negative)]/10 px-3 text-xs font-semibold text-red-300 hover:border-[var(--color-negative)]"
              >
                Clear
              </button>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,.png"
          className="hidden"
          onChange={(e) => {
            takeFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="mt-2 text-[11px] text-[var(--color-negative)]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
