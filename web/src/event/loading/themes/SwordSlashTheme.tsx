import { useState } from "react";
import type { EventLoadingThemeProps } from "../types";

/** Default blade if seed does not set `loading.asset`. */
export const DEFAULT_SWORD_ASSET = "/event-loading/sword-default.svg";

/**
 * Sword intro: drop → spin (wait) → horizontal slash → gone.
 * Swap the image via seed `loading.asset` (file in `web/public/event-loading/`).
 */
export function SwordSlashTheme({
  phase,
  onExitComplete,
  assetUrl,
}: EventLoadingThemeProps) {
  const preferred = assetUrl?.trim() || DEFAULT_SWORD_ASSET;
  const [src, setSrc] = useState(preferred);

  return (
    <div
      className={`evt-load-sword ${phase === "exit" ? "evt-load-sword--exit" : ""}`}
      onAnimationEnd={(e) => {
        if (phase === "exit" && e.animationName === "evt-sword-overlay-out") {
          onExitComplete();
        }
      }}
    >
      <div className="evt-load-sword__stage" aria-hidden>
        <div className="evt-load-sword__blade">
          <img
            key={preferred}
            src={src}
            alt=""
            className="evt-load-sword__img"
            draggable={false}
            onError={() => {
              if (src !== DEFAULT_SWORD_ASSET) setSrc(DEFAULT_SWORD_ASSET);
            }}
          />
        </div>
        <div className="evt-load-sword__slash" />
      </div>
      <p className="evt-load-sword__hint">Loading…</p>

      <style>{SWORD_CSS}</style>
    </div>
  );
}

const SWORD_CSS = `
.evt-load-sword {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at 50% 40%, #1a1410 0%, #050403 70%);
  color: #c9b08a;
}
.evt-load-sword__stage {
  position: relative;
  width: min(100vw, 480px);
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.evt-load-sword__blade {
  transform-origin: 50% 70%;
  animation: evt-sword-drop 0.55s ease-out both, evt-sword-spin 0.9s linear 0.55s infinite;
}
.evt-load-sword--exit .evt-load-sword__blade {
  animation: evt-sword-slash 0.55s ease-in forwards;
}
.evt-load-sword__img {
  display: block;
  width: auto;
  height: min(52vh, 260px);
  max-width: 120px;
  object-fit: contain;
  filter: drop-shadow(0 8px 16px rgba(0,0,0,0.65));
}
.evt-load-sword__slash {
  position: absolute;
  left: 8%;
  right: 8%;
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, #fff6d8, #ffd54f, #fff6d8, transparent);
  opacity: 0;
  transform: scaleX(0.2);
  pointer-events: none;
}
.evt-load-sword--exit .evt-load-sword__slash {
  animation: evt-sword-slash-beam 0.45s ease-out 0.2s forwards;
}
.evt-load-sword--exit {
  animation: evt-sword-overlay-out 0.35s ease-in 0.45s forwards;
}
.evt-load-sword__hint {
  margin-top: 1.25rem;
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.7;
}
.evt-load-sword--exit .evt-load-sword__hint {
  opacity: 0;
  transition: opacity 0.2s;
}
@keyframes evt-sword-drop {
  from { transform: translateY(-120%) rotate(-25deg); opacity: 0; }
  to { transform: translateY(0) rotate(0deg); opacity: 1; }
}
@keyframes evt-sword-spin {
  to { transform: rotate(360deg); }
}
@keyframes evt-sword-slash {
  0% { transform: rotate(0deg) scale(1); opacity: 1; }
  35% { transform: rotate(90deg) scale(1.05); }
  100% { transform: rotate(90deg) translateX(140%) scale(1.1); opacity: 0; }
}
@keyframes evt-sword-slash-beam {
  0% { opacity: 0; transform: scaleX(0.15); }
  40% { opacity: 1; transform: scaleX(1); }
  100% { opacity: 0; transform: scaleX(1.05); }
}
@keyframes evt-sword-overlay-out {
  to { opacity: 0; visibility: hidden; }
}
`;
