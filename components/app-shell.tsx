"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, LogOut, Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Role } from "@/lib/auth/roles";
import { activeHref, navSections } from "@/lib/nav";
import { createClient } from "@/lib/supabase/client";

/** Traditional sidebar (playbook: few pages) on desktop; below `md` the same
 *  nav opens from a menu button in a slim top bar. */
export function AppShell({
  role,
  isOwner,
  userName,
  userRole,
  children,
}: {
  role: Role;
  isOwner: boolean;
  userName: string;
  userRole: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);

  const sections = navSections({ role, isOwner });
  const current = activeHref(pathname, sections.flatMap((s) => s.items));
  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  function signOut() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  const nav = (
    <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.key}>
          {section.heading && (
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {section.heading}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = current === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      active ? "bg-brand-soft text-brand-deep" : "text-text hover:bg-inset hover:text-ink"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-border px-3 py-4">
      <Link
        href="/account"
        onClick={() => setMenuOpen(false)}
        className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{userName}</span>
          <span className="block text-xs text-muted">{userRole}</span>
        </span>
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={signOut}
          disabled={pending}
          className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          {pending ? "Signing out…" : "Sign out"}
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          View site
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );

  const header = (
    <div className="flex items-center gap-2 px-4 py-3.5">
      <Link
        href="/admin"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <BrandMark size={26} />
        <span className="truncate text-sm font-semibold text-ink">FBC Pittsgrove</span>
      </Link>
      <ThemeToggle size="sm" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        {header}
        {nav}
        {footer}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-2.5 md:hidden">
          <Link href="/admin" className="flex items-center gap-2 text-sm font-semibold text-ink">
            <BrandMark size={24} />
            FBC Pittsgrove
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="grid h-10 w-10 place-items-center rounded-lg text-ink hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </header>
        {menuOpen && (
          <div className="fixed inset-x-0 top-[57px] bottom-0 z-20 flex flex-col bg-surface md:hidden">
            {nav}
            {footer}
          </div>
        )}
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
