import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getLoadingTheme } from "./registry";
import { preloadImageUrls } from "./preload";
import type { EventLoadingConfig } from "./types";

type Props = {
  config: EventLoadingConfig | null | undefined;
  /** Portrait / hero URLs to prefetch while the wait animation loops. */
  preloadUrls: string[];
  /** False until event JSON is ready — gate stays up. */
  contentReady: boolean;
  children: ReactNode;
};

/**
 * Reusable event intro loader. Pick a theme via seed `loading.theme`;
 * register more themes in `./registry.ts`.
 */
export function EventLoadingGate({
  config,
  preloadUrls,
  contentReady,
  children,
}: Props) {
  const [phase, setPhase] = useState<"wait" | "exit" | "done">(() =>
    config ? "wait" : "done"
  );
  const urlsKey = useMemo(
    () => [...new Set(preloadUrls.filter(Boolean))].sort().join("|"),
    [preloadUrls]
  );

  useEffect(() => {
    if (!config) {
      setPhase("done");
      return;
    }
    if (!contentReady) {
      setPhase("wait");
      return;
    }

    let cancelled = false;
    const theme = getLoadingTheme(config.theme);
    const minMs = config.minMs ?? theme.defaultMinMs;
    const started = performance.now();
    const urls = urlsKey ? urlsKey.split("|") : [];
    if (config.asset) urls.push(config.asset);

    setPhase("wait");

    void (async () => {
      await preloadImageUrls(urls);
      const wait = Math.max(0, minMs - (performance.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      if (!cancelled) setPhase("exit");
    })();

    return () => {
      cancelled = true;
    };
  }, [config, contentReady, urlsKey]);

  if (!config || phase === "done") {
    return <>{children}</>;
  }

  const Theme = getLoadingTheme(config.theme).component;

  return (
    <div className="relative min-h-full">
      <div
        aria-hidden={phase === "wait"}
        style={{
          // Mount page under the overlay so images can decode into cache.
          visibility: phase === "wait" ? "hidden" : "visible",
        }}
      >
        {children}
      </div>
      <div
        className="fixed inset-0 z-50"
        role="status"
        aria-live="polite"
        aria-label="Loading event"
      >
        <Theme
          phase={phase === "exit" ? "exit" : "wait"}
          onExitComplete={() => setPhase("done")}
          assetUrl={config.asset}
        />
      </div>
    </div>
  );
}
