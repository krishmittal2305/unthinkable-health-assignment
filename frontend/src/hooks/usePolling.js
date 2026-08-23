import { useEffect, useRef } from "react";

export function usePolling(callback, intervalMs) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") tick();
    }

    const id = setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, intervalMs);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs]);
}
