import { useEffect, useRef, useState, type RefObject } from "react";
import {
  copyElementImageToClipboard,
  isClipboardImageSupported,
} from "../lib/copy-element-image";

type CopyState = "idle" | "copying" | "copied" | "failed";
const FEEDBACK_MS = 1800;

/**
 * Copies the rendered card (the element behind `targetRef`) to the clipboard as a PNG — the
 * same capture as the search screen's "Copy" pill, as a page-header button.
 */
export function CopyCardImageButton({
  targetRef,
  className = "",
}: {
  targetRef: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const [error, setError] = useState<string | null>(null);
  const resetTimer = useRef<number | null>(null);
  const supported = isClipboardImageSupported();

  useEffect(() => {
    return () => {
      if (resetTimer.current != null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const scheduleReset = () => {
    if (resetTimer.current != null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setState("idle");
      setError(null);
    }, FEEDBACK_MS);
  };

  const handleCopy = async () => {
    const element = targetRef.current;
    if (!element || state === "copying") return;
    setState("copying");
    setError(null);
    try {
      await copyElementImageToClipboard(element);
      setState("copied");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy failed");
      setState("failed");
    }
    scheduleReset();
  };

  const label =
    state === "copied" ? "Copied!" : state === "failed" ? "Failed" : state === "copying" ? "Copying…" : "Copy image";
  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      disabled={!supported || state === "copying"}
      aria-busy={state === "copying"}
      aria-live="polite"
      title={
        error ??
        (supported
          ? "Copy this card as an image to the clipboard"
          : "Image clipboard is not supported in this browser")
      }
      className={`ds-btn pressable min-h-9 px-3 text-sm whitespace-nowrap disabled:cursor-not-allowed ${
        state === "copied" ? "!text-emerald-300" : state === "failed" ? "!text-red-300" : ""
      } ${className}`}
    >
      {label}
    </button>
  );
}
