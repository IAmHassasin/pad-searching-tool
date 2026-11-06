import { domToBlob } from "modern-screenshot";

/**
 * Elements carrying this attribute are made invisible in the captured image.
 * They keep their layout box so text around them wraps exactly as on screen.
 */
export const SCREENSHOT_IGNORE_ATTR = "data-screenshot-ignore";

export function isClipboardImageSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function" &&
    typeof ClipboardItem !== "undefined"
  );
}

/**
 * Render `element` to a PNG and put it on the clipboard.
 * The capture uses the element's layout size so a CSS-scaled ancestor
 * (e.g. the fitted results pane) does not shrink the output.
 */
export async function copyElementImageToClipboard(
  element: HTMLElement
): Promise<void> {
  if (!isClipboardImageSupported()) {
    throw new Error("Image clipboard is not supported in this browser");
  }
  const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
  const pngPromise = domToBlob(element, {
    scale,
    width: element.offsetWidth,
    height: element.offsetHeight,
    backgroundColor: "#000000",
    quality: 1,
    onCloneEachNode: (cloned) => {
      if (
        cloned instanceof HTMLElement &&
        cloned.hasAttribute(SCREENSHOT_IGNORE_ATTR)
      ) {
        cloned.style.visibility = "hidden";
      }
    },
  }).then((blob) => {
    if (!blob) {
      throw new Error("Copy failed — try again after images load");
    }
    return blob;
  });
  // Passing a promise keeps the write inside the user gesture (Safari).
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": pngPromise }),
  ]);
}
