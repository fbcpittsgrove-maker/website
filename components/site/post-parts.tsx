import Link from "next/link";
import { CHURCH, addressLine } from "@/lib/church";

/** Article header for sermon posts and question pages: navy ground, serif
 *  title — the PageBanner look with a byline row. */
export function PostBanner({ eyebrow, title, byline }: { eyebrow: string; title: string; byline?: string }) {
  return (
    <section className="hero-ground text-on-hero">
      <div className="mx-auto max-w-3xl px-4 py-16 md:px-6 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] opacity-70">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.1] md:text-5xl">{title}</h1>
        {byline && <p className="mt-5 text-base opacity-85">{byline}</p>}
      </div>
    </section>
  );
}

/** "Join us" card at the foot of every post, built from lib/church.ts. */
export function VisitCta() {
  const sunday = CHURCH.schedule.find((d) => d.day === "Sunday");
  const morning = sunday?.services.find((s) => s.label === "Morning Service");
  return (
    <aside className="mt-14 rounded-2xl border border-border bg-surface p-8">
      <span aria-hidden className="rule-accent mb-4" />
      <h2 className="font-display text-3xl font-semibold text-ink">Come worship with us</h2>
      <p className="mt-3 text-text">
        {morning ? `Join us Sunday at ${morning.time} for the morning service` : "Join us on Sunday"} at {addressLine()}. Everyone is welcome.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/visit"
          className="rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Plan your visit
        </Link>
        <Link
          href="/sermons"
          className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          More sermons
        </Link>
      </div>
    </aside>
  );
}

/** A linked card for a question page. */
export function QuestionCard({ slug, title, description }: { slug: string; title: string; description?: string }) {
  return (
    <Link
      href={`/questions/${slug}`}
      className="block rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-accent-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <p className="font-display text-xl font-semibold leading-snug text-ink">{title}</p>
      {description && <p className="mt-2 text-sm text-text">{description}</p>}
      <p className="mt-3 text-sm font-semibold text-accent">Read the answer →</p>
    </Link>
  );
}
