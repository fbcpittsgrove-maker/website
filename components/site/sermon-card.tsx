import Link from "next/link";
import { formatDay } from "@/lib/content";
import type { PublicSermon } from "@/lib/content-server";

/** `postSlug` links the card to the sermon's written post, when published. */
export function SermonCard({ sermon, postSlug }: { sermon: PublicSermon; postSlug?: string }) {
  const byline = [sermon.preacher, sermon.scripture].filter(Boolean).join(" · ");
  return (
    <article className="rounded-2xl border border-border bg-surface p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{formatDay(sermon.preached_on)}</p>
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
