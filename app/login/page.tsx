import { LoginForm } from "@/components/login-form";
import { BrandLockup } from "@/components/brand-mark";

// The proxy's nonce CSP must reach this page's scripts — a prerendered page
// bakes them nonce-less and strict-dynamic blocks them all.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm">
        <BrandLockup size="md" className="mb-10 justify-center text-ink" />
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Sign in</h1>
          <p className="mt-2 text-sm text-muted">Church website admin</p>
        </div>
        <LoginForm error={error} />
      </div>
    </main>
  );
}
