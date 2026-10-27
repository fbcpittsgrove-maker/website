"use client";

import { useEffect } from "react";
import { isBrowserNoise } from "@/lib/browser-noise";

/** Global client crash sink: window errors and unhandled rejections POST to
 *  /api/report-issue so they land in the owner log instead of nowhere. */
export function ErrorReporter() {
  useEffect(() => {
    function send(message: string, detail?: unknown) {
      void fetch("/api/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "client",
          route: window.location.pathname,
          message,
          detail,
        }),
      }).catch(() => {});
    }
    function onError(event: ErrorEvent) {
      const message = event.message ?? "window error";
      const stack: string | undefined = event.error?.stack?.slice(0, 2000);
      if (isBrowserNoise(message, stack)) return;
      send(message, { stack });
    }
    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      if (isBrowserNoise(message, reason instanceof Error ? reason.stack : undefined)) return;
      send(message);
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
