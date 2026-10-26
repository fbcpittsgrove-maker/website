import {
  LayoutDashboard,
  CalendarDays,
  BookOpenText,
  Megaphone,
  UserCog,
  Milestone,
  Bug,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth/roles";

/**
 * ONE nav registry — the sidebar and the phone menu both read this. Zones: the
 * heading-less content group, then ADMIN and OWNER. A section's tier is its
 * `gate`, matching the server-side gate on each page.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGate = "all" | "admin" | "owner";

export type NavSection = {
  key: string;
  /** null = the heading-less content group. */
  heading: string | null;
  gate: NavGate;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    key: "content",
    heading: null,
    gate: "all",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/events", label: "Events", icon: CalendarDays },
      { href: "/admin/sermons", label: "Sermons", icon: BookOpenText },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
    ],
  },
  {
    key: "admin",
    heading: "Admin",
    gate: "admin",
    items: [
      { href: "/admin/users", label: "Users", icon: UserCog },
      { href: "/admin/roadmap", label: "Roadmap", icon: Milestone },
    ],
  },
  {
    key: "owner",
    heading: "Owner",
    gate: "owner",
    items: [
      { href: "/admin/issues", label: "Issues", icon: Bug },
      { href: "/admin/diagnostics", label: "Diagnostics", icon: Activity },
    ],
  },
];

export function navSections(opts: { role: Role; isOwner: boolean }): NavSection[] {
  return SECTIONS.filter((s) => {
    if (s.gate === "all") return true;
    if (s.gate === "admin") return opts.role === "admin" || opts.isOwner;
    return opts.isOwner;
  });
}

/** The nav item a pathname lives under — longest href wins, so
 *  /admin/events/new is Events and never Overview. */
export function activeHref(pathname: string, items: NavItem[]): string | null {
  let best: string | null = null;
  for (const { href } of items) {
    if (pathname === href || pathname.startsWith(href + "/")) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}
