import { domToBlob } from "modern-screenshot";

export async function exportElementToPng(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
  const blob = await domToBlob(element, {
    scale,
    backgroundColor: "#000000",
    quality: 1,
  });
  if (!blob) {
    throw new Error("Export failed — try again after images load");
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function buildExportFilename(number: number | null, name: string): string {
  const safeName = name.trim().replace(/[^\w\-]+/g, "_").slice(0, 40);
  if (number != null && Number.isFinite(number)) {
    return `custom-card-${number}${safeName ? `-${safeName}` : ""}.png`;
  }
  return `custom-card${safeName ? `-${safeName}` : ""}.png`;
}
