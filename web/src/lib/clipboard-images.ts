/** Reading images from the clipboard (paste event or an explicit button on touch devices). */

export function isImageFile(file: File | Blob): boolean {
  return file.type.startsWith("image/");
}

/** Whether `navigator.clipboard.read()` exists (Chrome, Safari 13.1+; needs a user gesture). */
export function isClipboardReadSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.clipboard?.read === "function";
}

/** Image files from a paste event, or an empty list. */
export function imagesFromPasteEvent(event: ClipboardEvent): File[] {
  return Array.from(event.clipboardData?.files ?? []).filter(isImageFile);
}

/**
 * Image files currently in the clipboard. Throws when the API is missing or the user denied
 * access; resolves to an empty list when the clipboard holds no image.
 */
export async function readClipboardImages(): Promise<File[]> {
  if (!isClipboardReadSupported()) {
    throw new Error("Reading the clipboard is not supported in this browser; use the file picker.");
  }
  const items = await navigator.clipboard.read();
  const files: File[] = [];
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (!type) continue;
    const blob = await item.getType(type);
    const ext = type.split("/")[1]?.split("+")[0] || "png";
    files.push(new File([blob], `clipboard-${Date.now()}-${files.length + 1}.${ext}`, { type }));
  }
  return files;
}
