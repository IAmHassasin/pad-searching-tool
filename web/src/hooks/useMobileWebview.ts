import { useEffect, useState } from "react";

const MOBILE_MAX_WIDTH = 768;

function readMobileWebviewFlag(): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("webview") === "1" || params.get("mobile") === "1") {
    return true;
  }

  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
}

export function useMobileWebview(): boolean {
  const [isMobileWebview, setIsMobileWebview] = useState(readMobileWebviewFlag);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    const onChange = () => setIsMobileWebview(readMobileWebviewFlag());
    mq.addEventListener("change", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  return isMobileWebview;
}
