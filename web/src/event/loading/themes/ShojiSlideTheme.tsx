import type { EventLoadingThemeProps } from "../types";

/**
 * Japanese sliding shoji: panels close during wait, then open on exit.
 * Optional `loading.asset` can tint as a paper texture overlay.
 */
export function ShojiSlideTheme({
  phase,
  onExitComplete,
  assetUrl,
}: EventLoadingThemeProps) {
  const texture = assetUrl?.trim() || "";

  return (
    <div
      className={`evt-load-shoji ${phase === "exit" ? "evt-load-shoji--exit" : ""}`}
      onAnimationEnd={(e) => {
        if (phase === "exit" && e.animationName === "evt-shoji-overlay-out") {
          onExitComplete();
        }
      }}
    >
      <div className="evt-load-shoji__frame" aria-hidden>
        <div className="evt-load-shoji__glow" />
        <ShojiPanel side="left" texture={texture} />
        <ShojiPanel side="right" texture={texture} />
      </div>
      <p className="evt-load-shoji__hint">Loading…</p>
      <style>{SHOJI_CSS}</style>
    </div>
  );
}

function ShojiPanel({
  side,
  texture,
}: {
  side: "left" | "right";
  texture: string;
}) {
  return (
    <div className={`evt-load-shoji__panel evt-load-shoji__panel--${side}`}>
      <div className="evt-load-shoji__wood">
        <div className="evt-load-shoji__paper">
          {texture ? (
            <img
              src={texture}
              alt=""
              className="evt-load-shoji__texture"
              draggable={false}
            />
          ) : null}
          <div className="evt-load-shoji__lattice" />
        </div>
        <div className="evt-load-shoji__handle" />
      </div>
    </div>
  );
}

const SHOJI_CSS = `
.evt-load-shoji {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse at 50% 45%, #2a1c12 0%, #0a0705 72%);
  color: #d4c4a8;
  overflow: hidden;
}
.evt-load-shoji__frame {
  position: relative;
  width: min(100vw, 720px);
  height: min(78vh, 520px);
  max-height: 100%;
}
.evt-load-shoji__glow {
  position: absolute;
  inset: 12% 48%;
  border-radius: 40%;
  background: radial-gradient(ellipse, rgba(255, 220, 150, 0.35), transparent 70%);
  opacity: 0;
  pointer-events: none;
  z-index: 0;
  animation: evt-shoji-glow-in 0.35s ease-out 0.45s forwards;
}
.evt-load-shoji--exit .evt-load-shoji__glow {
  animation: evt-shoji-glow-out 0.45s ease-in forwards;
}
.evt-load-shoji__panel {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50.4%;
  z-index: 1;
  will-change: transform;
}
.evt-load-shoji__panel--left {
  left: 0;
  transform: translateX(-102%);
  animation: evt-shoji-close-left 0.55s cubic-bezier(0.33, 0.9, 0.35, 1) forwards;
}
.evt-load-shoji__panel--right {
  right: 0;
  transform: translateX(102%);
  animation: evt-shoji-close-right 0.55s cubic-bezier(0.33, 0.9, 0.35, 1) forwards;
}
.evt-load-shoji--exit .evt-load-shoji__panel--left {
  animation: evt-shoji-open-left 0.65s cubic-bezier(0.55, 0.05, 0.4, 1) forwards;
}
.evt-load-shoji--exit .evt-load-shoji__panel--right {
  animation: evt-shoji-open-right 0.65s cubic-bezier(0.55, 0.05, 0.4, 1) forwards;
}
.evt-load-shoji__wood {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 10px;
  background:
    linear-gradient(160deg, #6b4a2e 0%, #3f2a18 42%, #2a1a0f 100%);
  border: 1px solid rgba(20, 12, 6, 0.85);
  box-shadow:
    inset 0 0 0 2px rgba(180, 140, 90, 0.22),
    0 10px 28px rgba(0, 0, 0, 0.45);
}
.evt-load-shoji__panel--left .evt-load-shoji__wood {
  border-right-width: 0;
  box-shadow:
    inset 0 0 0 2px rgba(180, 140, 90, 0.22),
    inset -8px 0 16px rgba(0, 0, 0, 0.25),
    0 10px 28px rgba(0, 0, 0, 0.45);
}
.evt-load-shoji__panel--right .evt-load-shoji__wood {
  border-left-width: 0;
  box-shadow:
    inset 0 0 0 2px rgba(180, 140, 90, 0.22),
    inset 8px 0 16px rgba(0, 0, 0, 0.25),
    0 10px 28px rgba(0, 0, 0, 0.45);
}
.evt-load-shoji__paper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 248, 230, 0.92), rgba(232, 214, 180, 0.88));
  box-shadow: inset 0 0 40px rgba(120, 80, 40, 0.12);
}
.evt-load-shoji__texture {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.28;
  mix-blend-mode: multiply;
  pointer-events: none;
}
.evt-load-shoji__lattice {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent calc(25% - 2px),
      rgba(70, 42, 20, 0.55) calc(25% - 2px),
      rgba(70, 42, 20, 0.55) 25%
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0,
      transparent calc(25% - 2px),
      rgba(70, 42, 20, 0.55) calc(25% - 2px),
      rgba(70, 42, 20, 0.55) 25%
    );
  box-shadow: inset 0 0 0 3px rgba(62, 38, 20, 0.75);
}
.evt-load-shoji__handle {
  position: absolute;
  top: 50%;
  width: 7px;
  height: 56px;
  margin-top: -28px;
  border-radius: 2px;
  background: linear-gradient(90deg, #8a6840, #4a3018);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
.evt-load-shoji__panel--left .evt-load-shoji__handle { right: 18px; }
.evt-load-shoji__panel--right .evt-load-shoji__handle { left: 18px; }
.evt-load-shoji__hint {
  position: absolute;
  bottom: max(1.5rem, 4vh);
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  opacity: 0.72;
  z-index: 2;
  transition: opacity 0.2s;
}
.evt-load-shoji--exit .evt-load-shoji__hint { opacity: 0; }
.evt-load-shoji--exit {
  animation: evt-shoji-overlay-out 0.35s ease-in 0.5s forwards;
}
@keyframes evt-shoji-close-left {
  from { transform: translateX(-102%); }
  to { transform: translateX(0); }
}
@keyframes evt-shoji-close-right {
  from { transform: translateX(102%); }
  to { transform: translateX(0); }
}
@keyframes evt-shoji-open-left {
  from { transform: translateX(0); }
  to { transform: translateX(-102%); }
}
@keyframes evt-shoji-open-right {
  from { transform: translateX(0); }
  to { transform: translateX(102%); }
}
@keyframes evt-shoji-glow-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes evt-shoji-glow-out {
  to { opacity: 0; }
}
@keyframes evt-shoji-overlay-out {
  to { opacity: 0; visibility: hidden; }
}
`;
