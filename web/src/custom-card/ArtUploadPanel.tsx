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
    <section className="rounded-lg border border-[var(--color-border)] bg-[#0d1117] p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#c9a84a]">
        Art &amp; icon
      </h2>
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
        className={`flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-3 py-4 text-center transition-colors ${
          dragOver
            ? "border-[#c9a84a] bg-[#3a2f12]/40"
            : "border-[var(--color-border)] bg-[#161b22]"
        }`}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Card art"
            className="max-h-48 w-auto rounded object-contain"
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
            className="rounded border border-[var(--color-border)] bg-[#21262d] px-2 py-1 text-xs hover:border-[#c9a84a]"
          >
            {sourceArtObjectUrl ? "Replace PNG" : "Upload PNG"}
          </button>
          {sourceArtObjectUrl && (
            <>
              <button
                type="button"
                onClick={onOpenArtCrop}
                className="rounded border border-[#c9a84a]/60 bg-[#3a2f12] px-2 py-1 text-xs text-[#f5e6c8] hover:border-[#c9a84a]"
              >
                {hasArtCrop ? "Recrop art" : "Crop art"}
              </button>
              <button
                type="button"
                onClick={onOpenIconCrop}
                className="rounded border border-[#c9a84a]/60 bg-[#3a2f12] px-2 py-1 text-xs text-[#f5e6c8] hover:border-[#c9a84a]"
              >
                {hasIcon ? "Recrop icon" : "Crop icon"}
              </button>
              <button
                type="button"
                onClick={onClearArt}
                className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:border-red-400"
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
        <p className="mt-2 text-[11px] text-red-300" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
