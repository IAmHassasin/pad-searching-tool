/**
 * Font fitting should run again only when the text column width changes.
 * The fit changes height on purpose. Chasing that height loops the scaled
 * detail-card frame on tall cards (long skill text plus inline icons).
 */
export function fontFitWidthChanged(
  previousWidth: number | null,
  nextWidth: number,
  epsilon = 0.5
): boolean {
  if (previousWidth == null || !Number.isFinite(previousWidth)) return true;
  if (!Number.isFinite(nextWidth)) return false;
  return Math.abs(previousWidth - nextWidth) >= epsilon;
}
