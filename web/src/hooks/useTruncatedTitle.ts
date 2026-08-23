import { useLayoutEffect, useRef, useState } from "react";

/**
 * Attach to a single-line truncated (`truncate`/`overflow-hidden`) element so
 * the full text only shows up as a tooltip when it's actually cut off —
 * ref goes on the element, `title` goes on the same element's `title` prop.
 */
export function useTruncatedTitle<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setIsTruncated(el.scrollWidth > el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return { ref, title: isTruncated ? text : undefined };
}
