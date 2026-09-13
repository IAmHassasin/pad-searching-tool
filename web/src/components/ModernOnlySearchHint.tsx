export function ModernOnlySearchHint({
  modernOnly,
  minMonsterId,
}: {
  modernOnly?: boolean;
  minMonsterId?: number;
}) {
  if (modernOnly !== true || minMonsterId == null || minMonsterId <= 0) {
    return null;
  }

  return (
    <p
      role="note"
      className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-inset)] px-3 py-1.5 text-[11px] leading-snug text-[var(--color-muted)]"
    >
      Showing monsters #{minMonsterId}+. Enter an exact ID (or NA#) for older
      cards.
    </p>
  );
}
