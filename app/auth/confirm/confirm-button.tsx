"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safe-next";
import type { EmailOtpType } from "@supabase/supabase-js";

export function ConfirmButton() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeNext(params.get("next"), "/update-password");

  if (!tokenHash || !type) {
    return (
      <p className="mt-6 rounded-lg border border-bad-line bg-bad-soft px-4 py-3 text-sm text-bad">
        This link is incomplete. Ask for a fresh invite.
      </p>
    );
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash!,
      type: type!,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="mt-6">
      <button
        onClick={confirm}
        disabled={busy}
        className="w-full rounded-lg bg-action px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-action-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {busy ? "Confirming…" : "Confirm sign-in"}
      </button>
      {error && (
        <p className="mt-4 rounded-lg border border-bad-line bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
