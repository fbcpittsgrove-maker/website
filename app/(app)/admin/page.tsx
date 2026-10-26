import Link from "next/link";
import { BookOpenText, CalendarDays, Megaphone } from "lucide-react";
import { getProfile } from "@/lib/auth/profile";
import { contentCounts } from "@/lib/content-server";

export const metadata = { title: "Admin" };

const CARDS = [
  { kind: "events", label: "Events", href: "/admin/events", icon: CalendarDays, blurb: "Services, studies and special events" },
  { kind: "sermons", label: "Sermons", href: "/admin/sermons", icon: BookOpenText, blurb: "Recent messages and recordings" },
  { kind: "announcements", label: "Announcements", href: "/admin/announcements", icon: Megaphone, blurb: "Notices on the homepage" },
] as const;

export default async function AdminHomePage() {
  const [profile, counts] = await Promise.all([getProfile(), contentCounts()]);
  const first = profile?.full_name.split(/\s+/)[0];
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight text-ink">{first ? `Welcome, ${first}` : "Welcome"}</h1>
      <p className="mt-1 text-sm text-muted">Keep the church website current. Changes show on the site as soon as you save.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {CARDS.map(({ kind, label, href, icon: Icon, blurb }) => (
          <Link
            key={kind}
            href={href}
            className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Icon className="h-5 w-5 text-brand" aria-hidden />
            <p className="mt-3 text-2xl font-bold text-ink">{counts[kind]}</p>
            <p className="text-sm font-semibold text-ink">{label}</p>
            <p className="mt-1 text-xs text-muted">{blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
