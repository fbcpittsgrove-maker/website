import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="text-center">
        <p className="font-display text-4xl font-semibold text-ink">404</p>
        <p className="mt-2 text-sm text-muted">That page doesn&apos;t exist.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-brand hover:text-brand-hover">
          Back to the homepage
        </Link>
      </div>
    </main>
  );
}
