"use client";

import { useEffect } from "react";

/** Error boundary inside the app shell: the sidebar stays, the page body
 *  reports and offers a retry. */
export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/report-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "client",
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
        message: error.message,
        detail: { digest: error.digest },
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <p className="font-display text-xl font-semibold text-ink">This page broke</p>
        <p className="mt-2 text-sm text-muted">
          It&apos;s been logged and the right people will see it.
        </p>
        <button
          onClick={reset}
          className="mt-6 w-full rounded-lg bg-action px-4 py-2.5 text-sm font-semibold text-on-brand hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
