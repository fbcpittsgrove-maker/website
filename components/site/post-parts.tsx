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

/** "Join us" card at the foot of every post, built from lib/church.ts, led
 *  by the way to know you're going to Heaven. */
export function VisitCta() {
  const sunday = CHURCH.schedule.find((d) => d.day === "Sunday");
  const morning = sunday?.services.find((s) => s.label === "Morning Service");
  return (
    <>
      <Link
        href="/salvation"
        className="hero-ground mt-14 block rounded-2xl px-8 py-7 text-on-hero transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.28em] opacity-70">The Bible way to Heaven</p>
        <p className="mt-2 font-display text-2xl font-semibold leading-snug">You can know 100% for sure that you will spend eternity in Heaven.</p>
        <p className="mt-3 text-sm font-semibold text-gold">See how from the Bible →</p>
      </Link>
      <aside className="mt-6 rounded-2xl border border-border bg-surface p-8">
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
    </>
  );
}

/** A linked card for a question page; `featured` dresses a pinned one. */
export function QuestionCard({ slug, title, description, featured = false }: { slug: string; title: string; description?: string; featured?: boolean }) {
  return (
    <Link
      href={`/questions/${slug}`}
      className={`block rounded-2xl border p-6 transition-colors hover:border-accent-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        featured ? "border-accent-line border-l-4 border-l-accent bg-accent-soft/60" : "border-border bg-surface"
      }`}
    >
      {featured && (
        <span className="mb-3 inline-block rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-on-brand">
          Featured
        </span>
      )}
      <p className="font-display text-xl font-semibold leading-snug text-ink">{title}</p>
      {description && <p className="mt-2 text-sm text-text">{description}</p>}
      <p className="mt-3 text-sm font-semibold text-accent">Read the answer →</p>
    </Link>
  );
}
