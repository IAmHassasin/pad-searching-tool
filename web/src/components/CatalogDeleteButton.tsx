import { useState } from "react";

type Props = {
  label: string;
  onDelete: () => Promise<void>;
};

export function CatalogDeleteButton({ label, onDelete }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 flex-col items-end justify-center gap-1 px-1">
      <button
        type="button"
        disabled={busy}
        className="rounded border border-red-900/80 px-2 py-1 text-xs text-red-300 hover:border-red-500 hover:text-red-100 disabled:opacity-50"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (
            !confirm(
              `Delete "${label}"? You can recreate it from Admin → Check for new.`
            )
          ) {
            return;
          }
          setError(null);
          setBusy(true);
          try {
            await onDelete();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "…" : "Delete"}
      </button>
      {error && <span className="max-w-[9rem] text-[10px] text-red-300">{error}</span>}
    </div>
  );
}
