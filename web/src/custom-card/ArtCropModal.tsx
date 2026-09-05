import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  clampArtCrop,
  defaultArtCrop,
  rasterizeArtCrop,
} from "./art-crop";
import { CUSTOM_CARD_ART_ASPECT, type ArtCropRect } from "./types";

type Props = {
  open: boolean;
  imageUrl: string;
  initialCrop: ArtCropRect | null;
  onCancel: () => void;
  onConfirm: (crop: ArtCropRect, artBlob: Blob) => void;
};

const VIEW_W = 300;
const VIEW_H = 400;
/** Fixed 2:3 crop window centered in the workspace. */
const FRAME_H = 300;
const FRAME_W = Math.round(FRAME_H * CUSTOM_CARD_ART_ASPECT);
const FRAME_LEFT = (VIEW_W - FRAME_W) / 2;
const FRAME_TOP = (VIEW_H - FRAME_H) / 2;

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 3;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Scale where the image exactly fits inside the crop frame (contain). */
function baseScaleForImage(nw: number, nh: number): number {
  return Math.min(FRAME_W / nw, FRAME_H / nh);
}

function cropFromView(
  nw: number,
  nh: number,
  zoom: number,
  panX: number,
  panY: number
): ArtCropRect {
  const scale = baseScaleForImage(nw, nh) * zoom;
  const dispW = nw * scale;
  const dispH = nh * scale;
  const imgLeft = FRAME_LEFT + FRAME_W / 2 - dispW / 2 + panX;
  const imgTop = FRAME_TOP + FRAME_H / 2 - dispH / 2 + panY;
  const height = FRAME_H / Math.max(dispH, 1e-9);
  return clampArtCrop(
    {
      x: (FRAME_LEFT - imgLeft) / Math.max(dispW, 1e-9),
      y: (FRAME_TOP - imgTop) / Math.max(dispH, 1e-9),
      height,
    },
    nw,
    nh
  );
}

function viewFromCrop(
  crop: ArtCropRect,
  nw: number,
  nh: number
): { zoom: number; panX: number; panY: number } {
  const c = clampArtCrop(crop, nw, nh);
  const base = baseScaleForImage(nw, nh);
  const dispH = FRAME_H / Math.max(c.height, 1e-9);
  const zoom = clamp(dispH / nh / base, ZOOM_MIN, ZOOM_MAX);
  const scale = base * zoom;
  const dispW = nw * scale;
  const dispH2 = nh * scale;
  const imgLeft = FRAME_LEFT - c.x * dispW;
  const imgTop = FRAME_TOP - c.y * dispH2;
  const panX = imgLeft - (FRAME_LEFT + FRAME_W / 2 - dispW / 2);
  const panY = imgTop - (FRAME_TOP + FRAME_H / 2 - dispH2 / 2);
  return { zoom, panX, panY };
}

export function ArtCropModal({
  open,
  imageUrl,
  initialCrop,
  onCancel,
  onConfirm,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originPan: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (natural.w <= 1 && natural.h <= 1) return;
    const crop = clampArtCrop(
      initialCrop ?? defaultArtCrop(natural.w, natural.h),
      natural.w,
      natural.h
    );
    const view = viewFromCrop(crop, natural.w, natural.h);
    setZoom(view.zoom);
    setPan({ x: view.panX, y: view.panY });
  }, [open, initialCrop, imageUrl, natural.w, natural.h]);

  const base = useMemo(
    () => baseScaleForImage(natural.w, natural.h),
    [natural.w, natural.h]
  );
  const scale = base * zoom;
  const dispW = natural.w * scale;
  const dispH = natural.h * scale;
  const imgLeft = FRAME_LEFT + FRAME_W / 2 - dispW / 2 + pan.x;
  const imgTop = FRAME_TOP + FRAME_H / 2 - dispH / 2 + pan.y;

  const currentCrop = useMemo(
    () => cropFromView(natural.w, natural.h, zoom, pan.x, pan.y),
    [natural.w, natural.h, zoom, pan.x, pan.y]
  );

  const setZoomKeepingCenter = (nextZoom: number) => {
    const z = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
    const cx = FRAME_LEFT + FRAME_W / 2;
    const cy = FRAME_TOP + FRAME_H / 2;
    const ix = (cx - imgLeft) / Math.max(dispW, 1e-9);
    const iy = (cy - imgTop) / Math.max(dispH, 1e-9);
    const nextScale = base * z;
    const nextW = natural.w * nextScale;
    const nextH = natural.h * nextScale;
    const nextImgLeft = cx - ix * nextW;
    const nextImgTop = cy - iy * nextH;
    setZoom(z);
    setPan({
      x: nextImgLeft - (FRAME_LEFT + FRAME_W / 2 - nextW / 2),
      y: nextImgTop - (FRAME_TOP + FRAME_H / 2 - nextH / 2),
    });
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originPan: pan,
    };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPan({
      x: drag.originPan.x + (e.clientX - drag.startX),
      y: drag.originPan.y + (e.clientY - drag.startY),
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const confirm = useCallback(async () => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    const { crop: c, blob } = await rasterizeArtCrop(img, currentCrop);
    onConfirm(c, blob);
  }, [currentCrop, onConfirm]);

  if (!open) return null;

  const zoomLabel = `${zoom.toFixed(1)}×`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal
      aria-label="Crop card art"
    >
      <div className="w-full max-w-md rounded-xl border border-[#a8842f] bg-[#1a1410] p-4 shadow-xl">
        <h3 className="mb-2 text-sm font-semibold text-[#f5e6c8]">
          Crop card art
        </h3>
        <p className="mb-3 text-[11px] text-[var(--color-muted)]">
          Fixed 2:3 frame. Drag the image to reposition; use the slider to zoom.
          Outside the image stays transparent.
        </p>
        <div
          className="relative mx-auto touch-none overflow-hidden rounded"
          style={{
            width: VIEW_W,
            height: VIEW_H,
            backgroundColor: "#0a0a0a",
            backgroundImage:
              "linear-gradient(45deg, #1c1c1c 25%, transparent 25%), linear-gradient(-45deg, #1c1c1c 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1c1c1c 75%), linear-gradient(-45deg, transparent 75%, #1c1c1c 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
            cursor: "grab",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt=""
            className="absolute select-none"
            draggable={false}
            style={{
              left: imgLeft,
              top: imgTop,
              width: dispW,
              height: dispH,
            }}
            onLoad={(e) => {
              const el = e.currentTarget;
              setNatural({ w: el.naturalWidth, h: el.naturalHeight });
            }}
          />
          {/* Dim outside the crop frame */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              boxShadow: `0 0 0 9999px rgba(0,0,0,0.55)`,
              left: FRAME_LEFT,
              top: FRAME_TOP,
              width: FRAME_W,
              height: FRAME_H,
            }}
          />
          <div
            className="pointer-events-none absolute border-2 border-[#ffd54f]"
            style={{
              left: FRAME_LEFT,
              top: FRAME_TOP,
              width: FRAME_W,
              height: FRAME_H,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded bg-black/50 px-1 text-[9px] text-[#ffd54f]">
                2:3
              </span>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-3 flex w-full max-w-[300px] items-center gap-2">
          <span className="text-[10px] text-[var(--color-muted)]" aria-hidden>
            −
          </span>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoomKeepingCenter(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#3a2f12] accent-[#c9a84a]"
            aria-label="Zoom"
          />
          <span className="text-[10px] text-[var(--color-muted)]" aria-hidden>
            +
          </span>
          <span className="w-9 text-right text-[10px] tabular-nums text-[#c9a84a]">
            {zoomLabel}
          </span>
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

/** Load image and bake a default (or given) portrait crop. */
export function applyArtCropFromUrl(
  imageUrl: string,
  crop: ArtCropRect | null
): Promise<{ crop: ArtCropRect; blob: Blob }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const base = crop ?? defaultArtCrop(img.naturalWidth, img.naturalHeight);
      void rasterizeArtCrop(img, base).then(resolve).catch(reject);
    };
    img.onerror = () => reject(new Error("Failed to load art for crop"));
    img.src = imageUrl;
  });
}
