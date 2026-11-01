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
      className="flex shrink-0 items-center gap-1.5 border-b border-[var(--color-border)] bg-[var(--color-secondary-muted)]/40 px-3 py-1 text-[10px] leading-snug text-[var(--color-muted)]"
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-secondary)]"
      />
      <span>
        Showing monsters{" "}
        <span className="font-mono font-semibold tabular-nums text-[var(--color-secondary-strong)]">
          #{minMonsterId}+
        </span>
        . Enter an exact ID (or NA#) for older cards.
      </span>
    </p>
  );
}
