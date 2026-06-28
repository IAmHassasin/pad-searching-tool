import { useEffect, useState } from "react";

/** Viewports shorter than this use single-section filter tabs. */
export const COMPACT_FILTER_MAX_HEIGHT = 820;

function readCompactFilterLayout(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(
    `(max-height: ${COMPACT_FILTER_MAX_HEIGHT}px)`
  ).matches;
}

export function useCompactFilterLayout(): boolean {
  const [compact, setCompact] = useState(readCompactFilterLayout);

  useEffect(() => {
    const mq = window.matchMedia(
      `(max-height: ${COMPACT_FILTER_MAX_HEIGHT}px)`
    );
    const onChange = () => setCompact(readCompactFilterLayout());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return compact;
}
