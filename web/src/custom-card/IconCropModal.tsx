import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { IconCropRect } from "./types";

type Props = {
  open: boolean;
  imageUrl: string;
  initialCrop: IconCropRect | null;
  onCancel: () => void;
  onConfirm: (crop: IconCropRect, iconBlob: Blob) => void;
};

const VIEW = 320;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Square crop: `size` is a fraction of min(naturalW, naturalH). */
function defaultCrop(nw: number, nh: number): IconCropRect {
  const short = Math.min(nw, nh);
  const size = Math.min(0.55, short / Math.max(nw, nh, 1));
  const side = short * size;
  return {
    size,
    x: (nw - side) / 2 / nw,
    y: (nh - side) / 2 / nh,
  };
}

function clampCrop(crop: IconCropRect, nw: number, nh: number): IconCropRect {
  const short = Math.min(nw, nh);
  const size = clamp(crop.size, 0.08, 1);
  const side = short * size;
  const maxX = Math.max(0, (nw - side) / nw);
  const maxY = Math.max(0, (nh - side) / nh);
  return {
    size,
    x: clamp(crop.x, 0, maxX),
    y: clamp(crop.y, 0, maxY),
  };
}

export function IconCropModal({
  open,
  imageUrl,
  initialCrop,
  onCancel,
  onConfirm,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [crop, setCrop] = useState<IconCropRect>({ x: 0.25, y: 0.25, size: 0.5 });
  const dragRef = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origin: IconCropRect;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (natural.w <= 1 && natural.h <= 1) return;
    setCrop(
      clampCrop(
        initialCrop ?? defaultCrop(natural.w, natural.h),
        natural.w,
        natural.h
      )
    );
  }, [open, initialCrop, imageUrl, natural.w, natural.h]);

  const displayScale = Math.min(VIEW / natural.w, VIEW / natural.h);
  const dispW = natural.w * displayScale;
  const dispH = natural.h * displayScale;
  const short = Math.min(natural.w, natural.h);
  /** Screen-space side of the square selection (always 1:1). */
  const squarePx = short * crop.size * displayScale;
  const leftPx = crop.x * dispW;
  const topPx = crop.y * dispH;

  const onPointerDown = (
    e: ReactPointerEvent,
    mode: "move" | "resize"
  ) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origin: crop,
    };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || dispW <= 0 || dispH <= 0) return;
    const dx = (e.clientX - drag.startX) / dispW;
    const dy = (e.clientY - drag.startY) / dispH;
    if (drag.mode === "move") {
      setCrop(
        clampCrop(
          {
            size: drag.origin.size,
            x: drag.origin.x + dx,
            y: drag.origin.y + dy,
          },
          natural.w,
          natural.h
        )
      );
    } else {
      // Resize by the larger axis delta, relative to short side in display space.
      const deltaPx = Math.max(
        e.clientX - drag.startX,
        e.clientY - drag.startY
      );
      const deltaSize = deltaPx / (short * displayScale);
      setCrop(
        clampCrop(
          {
            ...drag.origin,
            size: drag.origin.size + deltaSize,
          },
          natural.w,
          natural.h
        )
      );
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const confirm = useCallback(async () => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const c = clampCrop(crop, nw, nh);
    const side = Math.max(1, Math.floor(Math.min(nw, nh) * c.size));
    const sx = Math.floor(nw * c.x);
    const sy = Math.floor(nh * c.y);
    const canvas = document.createElement("canvas");
    const out = Math.max(side, 256);
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) return;
    onConfirm(c, blob);
  }, [crop, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal
      aria-label="Crop icon"
    >
      <div className="w-full max-w-md rounded-xl border border-[#a8842f] bg-[#1a1410] p-4 shadow-xl">
        <h3 className="mb-2 text-sm font-semibold text-[#f5e6c8]">
          Crop square icon
        </h3>
        <p className="mb-3 text-[11px] text-[var(--color-muted)]">
          Yellow box is always 1:1 (same as card icon). Drag to move; corner to
          resize.
        </p>
        <div
          className="relative mx-auto overflow-hidden rounded bg-black"
          style={{ width: VIEW, height: VIEW }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: dispW, height: dispH }}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt=""
              className="h-full w-full select-none object-contain"
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget;
                setNatural({ w: el.naturalWidth, h: el.naturalHeight });
              }}
            />
            <div
              className="absolute cursor-move border-2 border-[#ffd54f] bg-[#ffd54f]/15"
              style={{
                left: leftPx,
                top: topPx,
                width: squarePx,
                height: squarePx,
              }}
              onPointerDown={(e) => onPointerDown(e, "move")}
            >
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="rounded bg-black/50 px-1 text-[9px] text-[#ffd54f]">
                  1:1
                </span>
              </div>
              <button
                type="button"
                aria-label="Resize crop"
                className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-se-resize rounded-sm border border-[#ffd54f] bg-[#5c4a12]"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPointerDown(e, "resize");
                }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            className="rounded border border-[#c9a84a] bg-[#3a2f12] px-3 py-1.5 text-xs font-semibold text-[#f5e6c8]"
          >
            Apply crop
          </button>
        </div>
      </div>
    </div>
  );
}
