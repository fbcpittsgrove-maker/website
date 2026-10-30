import Link from "next/link";
import { ChevronRight, Pin } from "lucide-react";
import { requireStaff } from "@/lib/auth/profile";
import { formatDay } from "@/lib/content";
import { POST_KIND_LABEL, POST_STATUS_LABEL, type PostStatus } from "@/lib/posts";
import { listPosts, type AdminPostRow } from "@/lib/posts-server";

export const metadata = { title: "Blog" };

const GROUPS: { status: PostStatus; heading: string; blurb: string }[] = [
  { status: "draft", heading: "Ready for review", blurb: "Read each one, fix anything, then publish it." },
  { status: "needs_changes", heading: "Sent back", blurb: "Waiting on a new draft." },
  { status: "published", heading: "On the website", blurb: "Live now. You can still edit or take one down." },
  { status: "idea", heading: "Sermon ideas", blurb: "Questions people search for that no sermon has answered yet." },
];

const BADGE: Record<PostStatus, string> = {
  draft: "bg-warn-soft text-warn",
  needs_changes: "bg-inset text-muted",
  published: "bg-ok-soft text-ok",
  idea: "bg-brand-soft text-brand-deep",
};

function Row({ post }: { post: AdminPostRow }) {
  const detail = [POST_KIND_LABEL[post.kind], post.sermon ? `${post.sermon.title} · ${formatDay(post.sermon.preached_on)}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <li>
      <Link
        href={`/admin/posts/${post.id}`}
        className="flex items-center justify-between gap-3 p-4 hover:bg-inset focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
      >
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
            {post.status === "idea" ? post.question : post.title}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[post.status]}`}>{POST_STATUS_LABEL[post.status]}</span>
            {post.pinned_at && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                <Pin className="h-3 w-3" aria-hidden />
                Pinned
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-muted">{detail}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

export default async function AdminPostsPage() {
  await requireStaff();
  const posts = await listPosts();
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Blog</h1>
      <p className="mt-1 text-sm text-muted">
        Posts written from each Sunday&apos;s sermon, and answers to common Bible questions drawn from the preaching. Nothing shows on the
        website until you publish it.
      </p>
      {posts.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted">No posts yet.</p>
      ) : (
        GROUPS.map(({ status, heading, blurb }) => {
          const rows = posts.filter((p) => p.status === status).sort((a, b) => Number(!!b.pinned_at) - Number(!!a.pinned_at));
          if (rows.length === 0) return null;
          return (
            <section key={status} className="mt-8">
              <h2 className="text-sm font-semibold text-ink">
                {heading} <span className="font-normal text-muted">({rows.length})</span>
              </h2>
              <p className="text-xs text-muted">{blurb}</p>
              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {rows.map((p) => (
                  <Row key={p.id} post={p} />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
