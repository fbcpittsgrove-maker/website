import Link from "next/link";
import { formatDay } from "@/lib/content";
import type { PublicSermon } from "@/lib/content-server";

/** `postSlug` links the card to the sermon's written post, when published.
 *  `featured` dresses a pinned sermon: burgundy edge and a "Featured" tag. */
export function SermonCard({ sermon, postSlug, featured = false }: { sermon: PublicSermon; postSlug?: string; featured?: boolean }) {
  const byline = [sermon.preacher, sermon.scripture].filter(Boolean).join(" · ");
  return (
    <article className={`rounded-2xl border p-6 ${featured ? "border-accent-line border-l-4 border-l-accent bg-accent-soft/60" : "border-border bg-surface"}`}>
      <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        {featured && <span className="rounded-full bg-accent px-2.5 py-0.5 text-[10px] tracking-[0.2em] text-on-brand">Featured</span>}
        {formatDay(sermon.preached_on)}
      </p>
      <h3 className="mt-2 font-display text-2xl font-semibold leading-snug text-ink">
        {postSlug ? (
          <Link href={`/sermons/${postSlug}`} className="hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            {sermon.title}
          </Link>
        ) : (
          sermon.title
        )}
      </h3>
      {byline && <p className="mt-1 text-sm text-muted">{byline}</p>}
      {sermon.summary && <p className="mt-3 whitespace-pre-line text-text">{sermon.summary}</p>}
      {postSlug && (
        <Link href={`/sermons/${postSlug}`} className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
          Read the message →
        </Link>
      )}
      {(sermon.video_url || sermon.audio_url) && (
        <div className="mt-4 flex gap-3">
          {sermon.video_url && (
            <a
              href={sermon.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-on-brand hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Watch
            </a>
          )}
          {sermon.audio_url && (
            <a
              href={sermon.audio_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Listen
            </a>
          )}
        </div>
      )}
    </article>
  );
}
