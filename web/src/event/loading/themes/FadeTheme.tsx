import type { EventLoadingThemeProps } from "../types";

/** Minimal fallback theme for events without a custom flourish. */
export function FadeTheme({ phase, onExitComplete }: EventLoadingThemeProps) {
  return (
    <div
      className={`evt-load-fade ${phase === "exit" ? "evt-load-fade--exit" : ""}`}
      onTransitionEnd={(e) => {
        if (phase === "exit" && e.propertyName === "opacity") {
          onExitComplete();
        }
      }}
    >
      <div className="evt-load-fade__dot" />
      <p className="evt-load-fade__hint">Loading…</p>
      <style>{FADE_CSS}</style>
    </div>
  );
}

const FADE_CSS = `
.evt-load-fade {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: #0d0a06;
  color: #c9b08a;
  transition: opacity 0.4s ease;
}
.evt-load-fade--exit { opacity: 0; }
.evt-load-fade__dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #ffd54f;
  animation: evt-fade-pulse 0.8s ease-in-out infinite;
}
.evt-load-fade__hint {
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.7;
}
@keyframes evt-fade-pulse {
  0%, 100% { transform: scale(0.85); opacity: 0.5; }
  50% { transform: scale(1.15); opacity: 1; }
}
`;
