"use client";

import { useEffect } from "react";

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
      send(event.message ?? "window error", { stack: event.error?.stack?.slice(0, 2000) });
    }
    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      send(reason instanceof Error ? reason.message : String(reason));
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
