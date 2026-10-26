"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasswordCard() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      // Verbatim — Supabase's HIBP message is plain English.
      setError(error.message);
      return;
    }
    setSaved(true);
    setPassword("");
    setConfirm("");
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Change password</h2>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-label="New password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-label="Confirm new password"
          placeholder="Again"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        {error && (
          <p className="rounded-lg border border-bad-line bg-bad-soft px-4 py-3 text-sm text-bad">
            {error}
          </p>
        )}
        {saved && (
          <p className="rounded-lg border border-ok-line bg-ok-soft px-4 py-3 text-sm text-ok">
            Password updated.
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-on-brand hover:bg-action-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </section>
  );
}
