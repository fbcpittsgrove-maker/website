"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { verifiedTotpFactor } from "@/lib/auth/mfa";

type EnrolState = { id: string; qr: string; secret: string } | null;

export function MfaPanel() {
  const router = useRouter();
  const [factor, setFactor] = useState<{ id: string } | null>(null);
  const [enrol, setEnrol] = useState<EnrolState>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const f = await verifiedTotpFactor(supabase);
        setFactor(f ? { id: f.id } : null);
      } catch {
        setError("Couldn't read your two-factor status.");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function startEnrol() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // An abandoned setup leaves an unverified factor whose name collides and
    // blocks re-enrol — clear stale ones first.
    const { data } = await supabase.auth.mfa.listFactors();
    for (const f of data?.all ?? []) {
      if (f.factor_type === "totp" && f.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }
    const { data: enrolled, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEnrol({ id: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
  }

  async function verifyEnrol(value: string) {
    setCode(value);
    if (value.length !== 6 || !enrol) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrol.id,
      code: value,
    });
    if (error) {
      setError(error.message);
      setCode("");
      setBusy(false);
      return;
    }
    // The server must see the aal2 session, not just the browser.
    router.refresh();
    setFactor({ id: enrol.id });
    setEnrol(null);
    setCode("");
    setBusy(false);
  }

  async function turnOff() {
    if (!factor) return;
    // Unenroll requires aal2 — the code is both the proof and the upgrade.
    const value = code;
    if (value.length !== 6) {
      setError("Enter your current 6-digit code first.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: value,
    });
    if (verifyError) {
      setError(verifyError.message);
      setCode("");
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
    setFactor(null);
    setCode("");
  }

  if (!loaded) {
    return <div className="h-24 animate-pulse rounded-xl border border-border bg-surface" />;
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Two-factor sign-in</h2>

      {factor ? (
        <>
          <p className="mt-2 text-sm text-muted">
            On — your account asks for an authenticator code after the password.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              aria-label="Current authenticator code"
              placeholder="Current code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-36 rounded-lg border border-border-strong bg-inset px-3 py-2 text-center font-mono text-sm text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            />
            <button
              onClick={turnOff}
              disabled={busy}
              className="rounded-lg border border-bad-line bg-bad-soft px-4 py-2 text-sm font-medium text-bad hover:opacity-80 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Turn off
            </button>
          </div>
        </>
      ) : enrol ? (
        <div className="mt-4">
          <p className="text-sm text-muted">
            Scan with your authenticator app, then enter its 6-digit code.
          </p>
          <div className="mt-4 flex items-start gap-6">
            {/* data: URI straight from Supabase — never an external fetch */}
            <Image src={enrol.qr} alt="Authenticator QR code" width={144} height={144} unoptimized className="h-36 w-36 rounded-lg border border-border" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
                Manual key
              </p>
              <p className="mt-1 break-all font-mono text-xs text-ink">{enrol.secret}</p>
            </div>
          </div>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            aria-label="Authenticator code"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => verifyEnrol(e.target.value.replace(/\D/g, ""))}
            className="mt-4 w-44 rounded-lg border border-border-strong bg-inset px-3 py-2 text-center font-mono text-lg tracking-[0.4em] text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            disabled={busy}
          />
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            Off — add an authenticator app for a second step at sign-in.
          </p>
          <button
            onClick={startEnrol}
            disabled={busy}
            className="mt-4 rounded-lg bg-action px-4 py-2 text-sm font-semibold text-on-brand hover:bg-action-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Set up two-factor
          </button>
        </>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-bad-line bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}
    </section>
  );
}
