"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      // Supabase's text is plain English (incl. the HIBP weak-password
      // message) — surface it verbatim, never a generic "try again".
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
        New password
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
      </label>
      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">
        Again
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
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
        {busy ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
