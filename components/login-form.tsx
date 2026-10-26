"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ACCESS_ERRORS: Record<string, string> = {
  deactivated: "This account is deactivated — contact an admin.",
};

/**
 * Email + password, then a 6-digit authenticator step when the account has
 * TOTP enrolled. The mount effect runs the same pending check so a
 * half-authed session bounced back by the proxy resumes at the code step
 * instead of showing email/password again. An ?error= from the proxy means
 * the session can't enter the app, so it shows the reason and a sign-out
 * escape instead of the form.
 */
export function LoginForm({ error: accessError }: { error?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaStep, setMfaStep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessMessage = accessError
    ? ACCESS_ERRORS[accessError] ?? "This account can't access the app — contact an admin."
    : null;

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const checkPending = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.nextLevel === "aal2" && data.currentLevel !== "aal2") {
      setMfaStep(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async MFA resume check, not render-derived state
    void checkPending();
  }, [checkPending]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.nextLevel === "aal2" && data.currentLevel !== "aal2") {
      setMfaStep(true);
      setBusy(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  async function submitCode(value: string) {
    setCode(value);
    if (value.length !== 6) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp[0];
    if (!totp) {
      setError("No authenticator found on this account — sign in again.");
      setCode("");
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: totp.id,
      code: value,
    });
    if (error) {
      setError(error.message);
      setCode("");
      setBusy(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  async function useDifferentAccount() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMfaStep(false);
    setCode("");
    setError(null);
  }

  if (accessMessage) {
    return (
      <div className="rounded-xl border border-bad-line bg-bad-soft p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-bad">Can&apos;t sign in</h2>
        <p className="mt-1 text-sm text-bad">{accessMessage}</p>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="mt-4 w-full rounded-lg border border-border-strong px-4 py-2.5 text-sm font-medium text-ink hover:bg-inset disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    );
  }

  if (mfaStep) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">Two-factor code</h2>
        <p className="mt-1 text-sm text-muted">
          Enter the 6-digit code from your authenticator app.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          aria-label="Two-factor code"
          value={code}
          onChange={(e) => submitCode(e.target.value.replace(/\D/g, ""))}
          className="mt-4 w-full rounded-lg border border-border-strong bg-inset px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          disabled={busy}
        />
        {error && (
          <p className="mt-4 rounded-lg border border-bad-line bg-bad-soft px-4 py-3 text-sm text-bad">
            {error}
          </p>
        )}
        <button
          onClick={useDifferentAccount}
          className="mt-4 w-full text-center text-sm text-muted underline-offset-2 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Use a different account
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submitPassword} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
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
      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">
        Password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <div className="mt-4 text-center">
        <a href="/forgot-password" className="text-xs font-medium uppercase tracking-wide text-muted hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          Forgot password?
        </a>
      </div>
    </form>
  );
}
