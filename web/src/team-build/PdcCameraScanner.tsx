import { useEffect, useRef, useState } from "react";
import { classifyQrText, readQrText, type QrScanResult } from "../lib/team-build/pdc-qr-scan";

type Props = {
  /** Called once with the first PDC team found; the camera is stopped before. */
  onFound: (result: Extract<QrScanResult, { kind: "pdc" }>) => void;
  onCancel: () => void;
};

/** Minimal shape of the Shape Detection API (not in the TS DOM lib). */
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

/** Pause between two decode attempts; jsQR on a 900 px frame takes ~100 ms on a phone. */
const SCAN_INTERVAL_MS = 180;
/** Side of the square centre crop that is decoded, in video pixels at most. */
const MAX_CROP_PX = 900;

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was refused. Allow the camera for this app in Android settings. If the app never asked, install the latest APK (older versions have no camera permission).";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found on this device.";
  if (name === "NotReadableError") return "The camera is busy in another app.";
  return err instanceof Error ? err.message : "Could not start the camera.";
}

function barcodeDetector(): BarcodeDetectorLike | null {
  const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    // Constructor exists but QR is unsupported on this device: jsQR handles it.
    return null;
  }
}

/** Live camera view that scans for a PDC team QR (used in the Android app). */
export function PdcCameraScanner({ onFound, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState("Starting the camera…");
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const detector = barcodeDetector();

    const stop = () => {
      stopped = true;
      if (timer != null) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };

    const scanOnce = async (): Promise<string | null> => {
      const video = videoRef.current;
      if (!video || !ctx || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
      const side = Math.min(video.videoWidth, video.videoHeight);
      if (!side) return null;
      const scale = Math.min(1, MAX_CROP_PX / side);
      canvas.width = Math.round(side * scale);
      canvas.height = Math.round(side * scale);
      ctx.drawImage(
        video,
        (video.videoWidth - side) / 2,
        (video.videoHeight - side) / 2,
        side,
        side,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      if (detector) {
        const codes = await detector.detect(canvas);
        return codes[0]?.rawValue ?? null;
      }
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return readQrText({ data, width, height });
    };

    const loop = async () => {
      if (stopped) return;
      try {
        const text = await scanOnce();
        if (stopped) return;
        if (text != null) {
          const result = classifyQrText(text);
          if (result?.kind === "pdc") {
            stop();
            onFoundRef.current(result);
            return;
          }
          setHint("That QR code is not a PDC team. Point at the QR of a PDC team image.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read the camera frame.");
        stop();
        return;
      }
      timer = window.setTimeout(() => void loop(), SCAN_INTERVAL_MS);
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This device does not give the app access to a camera.");
      return stop;
    }
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      .then(async (s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        await video.play();
        setHint("Point the camera at the QR code of a PDC team image.");
        void loop();
      })
      .catch((err: unknown) => {
        if (!stopped) setError(cameraErrorMessage(err));
      });

    return stop;
  }, []);

  return (
    <div className="space-y-2">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {/* Guide square: the decoded area is the centre crop of the frame. */}
        <div className="pointer-events-none absolute inset-[12%] rounded-lg border-2 border-white/70" />
      </div>
      {error ? (
        <p role="alert" className="text-center text-[11px] text-red-300">
          {error}
        </p>
      ) : (
        <p aria-live="polite" className="text-center text-[11px] text-[var(--color-muted)]">
          {hint}
        </p>
      )}
      <div className="flex justify-center">
        <button type="button" onClick={onCancel} className="ds-btn pressable min-h-9 px-4 text-xs">
          Stop camera
        </button>
      </div>
    </div>
  );
}
