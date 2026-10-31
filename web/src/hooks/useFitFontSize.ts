import { useLayoutEffect, useRef, useState } from "react";
import { fontFitWidthChanged } from "../lib/font-fit-resize";

/**
 * Shrink a container's font-size until its content fits `maxHeightPx`,
 * or until `minPx`. Children should use `em` so they follow this size.
 */
export function useFitFontSize({
  minPx,
  maxPx,
  maxHeightPx,
  resetKey,
}: {
  minPx: number;
  maxPx: number;
  maxHeightPx: number;
  resetKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fontPx, setFontPx] = useState(maxPx);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      const apply = (size: number) => {
        el.style.fontSize = `${size}px`;
      };

      apply(maxPx);
      if (el.scrollHeight <= maxHeightPx + 1) {
        setFontPx(maxPx);
        return;
      }

      let lo = minPx;
      let hi = maxPx;
      let best = minPx;
      for (let i = 0; i < 14; i++) {
        const mid = Math.round(((lo + hi) / 2) * 10) / 10;
        apply(mid);
        if (el.scrollHeight <= maxHeightPx + 1) {
          best = mid;
          lo = mid + 0.1;
        } else {
          hi = mid - 0.1;
        }
        if (hi < lo) break;
      }
      apply(best);
      setFontPx(best);
    };

    fit();
    const parent = el.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    // fit() already measured this layout. The observer also fires once on
    // subscribe; that sample only records width so a height change cannot
    // immediately run fit() again.
    let sawWidth = false;
    let lastWidth: number | null = null;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width == null) return;
      const changed = fontFitWidthChanged(lastWidth, width);
      lastWidth = width;
      if (!sawWidth) {
        sawWidth = true;
        return;
      }
      if (!changed) return;
      fit();
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, [minPx, maxPx, maxHeightPx, resetKey]);

  return { ref, fontPx };
}
