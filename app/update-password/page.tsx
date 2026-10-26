import { UpdatePasswordForm } from "@/components/update-password-form";
import { BrandLockup } from "@/components/brand-mark";

// Nonce CSP needs a dynamic render (see /login).
export const dynamic = "force-dynamic";

export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <BrandLockup size="md" className="mb-8 justify-center text-ink" />
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Choose your password</h1>
          <p className="mt-1 text-sm text-muted">
            First visit or reset — set a new password to continue.
          </p>
        </div>
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
