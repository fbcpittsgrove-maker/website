import { Suspense } from "react";
import { ConfirmButton } from "./confirm-button";
import { BrandLockup } from "@/components/brand-mark";

// The proxy's nonce CSP must reach this page's scripts — a prerendered page
// bakes them nonce-less and strict-dynamic blocks them all.
export const dynamic = "force-dynamic";

/**
 * Scanner-proof interstitial. Renders free on GET (mail-security scanners
 * prefetch links and would spend a single-use token before the human clicks);
 * the token is spent ONLY on this button's POST via verifyOtp.
 */
export default function AuthConfirmPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <BrandLockup size="md" className="mb-6 justify-center text-ink" />
        <p className="mt-2 text-sm text-muted">
          Your sign-in link is ready. Confirm it&apos;s really you:
        </p>
        <Suspense>
          <ConfirmButton />
        </Suspense>
      </div>
    </main>
  );
}
