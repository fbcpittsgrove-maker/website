"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safe-next";
import { BrandLockup } from "@/components/brand-mark";

// The proxy's nonce CSP must reach this page's scripts — a prerendered page
// bakes them nonce-less and strict-dynamic blocks them all.
export const dynamic = "force-dynamic";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function linkError() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return hash.get("error_description")?.replace(/\+/g, " ") ?? null;
}

/**
 * Rescue for implicit-flow email links: the tokens arrive in the URL fragment
 * (#access_token=…), which no server can read. Supabase's browser client
 * picks the fragment up itself (detectSessionInUrl), so we wait for the
 * session, then route on. Real error copy instead of a silent login bounce.
 */
export default function AuthFinishPage() {
  const router = useRouter();
  const [timeoutError, setTimeoutError] = useState<string | null>(null);
  const hashError = useSyncExternalStore(subscribeToHash, linkError, () => null);
  const error = hashError ?? timeoutError;

  useEffect(() => {
    const supabase = createClient();
    const next = safeNext(new URLSearchParams(window.location.search).get("next"), "/admin");
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        subscription.unsubscribe();
        router.push(next);
        router.refresh();
      }
    });
    const timer = setTimeout(
      () => setTimeoutError("This link has expired or was already used. Ask for a fresh one."),
      8000,
    );
    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <BrandLockup size="md" className="mb-6 justify-center text-ink" />
        {error ? (
          <>
            <p className="mt-4 rounded-lg border border-bad-line bg-bad-soft px-4 py-3 text-sm text-bad">
              {error}
            </p>
            <a
              href="/login"
              className="mt-4 inline-block text-sm font-medium text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Back to sign in
            </a>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">Finishing your sign-in…</p>
        )}
      </div>
    </main>
  );
}
