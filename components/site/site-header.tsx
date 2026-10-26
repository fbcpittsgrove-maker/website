"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/ministries", label: "Ministries" },
  { href: "/sermons", label: "Sermons" },
  { href: "/events", label: "Events" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
          <BrandMark size={30} className="text-accent" />
          <span className="leading-none">
            <span className="block font-display text-[22px] font-semibold text-ink">Faith Baptist Church</span>
            <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">of Pittsgrove</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`rounded-md px-3 py-2 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                isActive(href) ? "text-accent" : "text-text hover:text-ink"
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/visit"
            className="ml-2 rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Plan Your Visit
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="grid h-11 w-11 place-items-center rounded-lg text-ink hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
        >
          {open ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
        </button>
      </div>

      {open && (
        <nav aria-label="Main" className="border-t border-border bg-surface px-4 pb-6 pt-2 lg:hidden">
          <ul>
            {LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={`block border-b border-border-soft py-3.5 font-display text-2xl font-semibold ${isActive(href) ? "text-accent" : "text-ink"}`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/visit"
            onClick={() => setOpen(false)}
            className="mt-5 block rounded-full bg-action px-5 py-3 text-center font-semibold text-on-brand hover:bg-action-hover"
          >
            Plan Your Visit
          </Link>
        </nav>
      )}
    </header>
  );
}
