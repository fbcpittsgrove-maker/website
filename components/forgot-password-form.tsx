"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/app/forgot-password/actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await requestPasswordReset(email);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        <p className="text-sm text-ink">
          If that email has an account, a reset link is on its way. The link
          opens a confirmation page — one click there finishes it.
        </p>
        <a href="/login" className="mt-4 inline-block text-sm font-medium text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
      </label>
      {error && (
        <p className="mt-4 rounded-lg border border-bad-line bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-lg bg-action px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-action-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
