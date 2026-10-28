"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleAlert, ExternalLink, Trash2 } from "lucide-react";
import { deletePost, savePost, setPostStatus } from "@/app/(app)/admin/posts/actions";
import { ArticleMarkdown } from "@/lib/article-markdown";
import { formatDay } from "@/lib/content";
import {
  DESCRIPTION_RANGE,
  POST_KIND_LABEL,
  POST_STATUS_LABEL,
  TITLE_RANGE,
  formatTimestamp,
  postPath,
  publishProblems,
  wordCount,
  type PostForm,
} from "@/lib/posts";
import type { AdminPost } from "@/lib/posts-server";

const INPUT =
  "w-full rounded-lg border border-border-strong bg-inset px-3 py-2 text-sm text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const LABEL = "mb-1 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-muted";
const PRIMARY =
  "rounded-lg bg-action px-4 py-2 text-sm font-semibold text-on-brand hover:bg-action-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const SECONDARY =
  "rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-ink hover:bg-inset disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function Count({ n, range }: { n: number; range: { min: number; max: number } }) {
  const ok = n >= range.min && n <= range.max;
  return (
    <span className={`font-normal normal-case tracking-normal ${ok ? "text-ok" : "text-warn"}`}>
      {n} / {range.min}–{range.max}
    </span>
  );
}

/** Steven's review screen: the draft beside what it was written from, the
 *  publish checklist live as he edits, and the publish / send back actions. */
export function PostEditor({ post }: { post: AdminPost }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<PostForm>({
    title: post.title,
    slug: post.slug,
    description: post.description,
    question: post.question,
    body_md: post.body_md,
    reviewer_notes: post.reviewer_notes,
  });

  const isIdea = post.status === "idea";
  const problems = publishProblems({ kind: post.kind, ...form, sermon: post.sermon });
  const words = wordCount(form.body_md);

  const segments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return post.transcripts.map((t) => ({
      ...t,
      matches: q ? t.segments.filter((s) => s.text.toLowerCase().includes(q)) : t.segments,
    }));
  }, [post.transcripts, search]);

  function set<K extends keyof PostForm>(key: K, value: PostForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function run(work: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    startTransition(async () => {
      setError(null);
      const result = await work();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  const save = () => run(() => savePost(post.id, form), () => setSaved(true));
  const publish = () =>
    run(async () => {
      const s = await savePost(post.id, form);
      return s.ok ? setPostStatus(post.id, "published") : s;
    });
  const sendBack = () =>
    run(async () => {
      const s = await savePost(post.id, form);
      return s.ok ? setPostStatus(post.id, "needs_changes") : s;
    });
  const takeDown = () => run(() => setPostStatus(post.id, "draft"));
  const remove = () =>
    run(
      () => deletePost(post.id),
      () => router.push("/admin/posts"),
    );

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/posts" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All posts
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {POST_KIND_LABEL[post.kind]} · {POST_STATUS_LABEL[post.status]}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{isIdea ? post.question : form.title}</h1>
          {post.sermon && (
            <p className="mt-1 text-sm text-muted">
              From “{post.sermon.title}” · {formatDay(post.sermon.preached_on)} · {post.sermon.preacher || "preacher not set"} ·{" "}
              <Link href="/admin/sermons" className="font-medium text-brand hover:underline">
                Edit sermon details
              </Link>
            </p>
          )}
        </div>
        {post.status === "published" && (
          <a
            href={postPath(post.kind, post.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            View on the website
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-bad-line bg-bad-soft px-4 py-2.5 text-sm text-bad">
          {error}
        </p>
      )}

      {post.reviewer_notes && (
        <section className="mt-5 rounded-xl border border-accent-line bg-accent-soft p-4">
          <h2 className="text-sm font-semibold text-ink">Notes for the reviewer</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-text">{post.reviewer_notes}</p>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {!isIdea && (
            <>
              <div>
                <label htmlFor="post-title" className={LABEL}>
                  Title <Count n={form.title.trim().length} range={TITLE_RANGE} />
                </label>
                <input id="post-title" value={form.title} onChange={(e) => set("title", e.target.value)} className={INPUT} />
              </div>
              <div>
                <label htmlFor="post-description" className={LABEL}>
                  Search summary <Count n={form.description.trim().length} range={DESCRIPTION_RANGE} />
                </label>
                <textarea
                  id="post-description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  className={INPUT}
                />
                <p className="mt-1 text-xs text-muted">Shown under the title in Google and when the link is shared.</p>
              </div>
            </>
          )}
          {post.kind === "question" && (
            <div>
              <label htmlFor="post-question" className={LABEL}>
                Question
              </label>
              <input id="post-question" value={form.question} onChange={(e) => set("question", e.target.value)} className={INPUT} />
              <p className="mt-1 text-xs text-muted">Worded the way people ask it.</p>
            </div>
          )}
          <div>
            <label htmlFor="post-slug" className={LABEL}>
              Web address
            </label>
            <div className="flex items-center gap-1 text-sm text-muted">
              <span className="shrink-0">{post.kind === "sermon" ? "/sermons/" : "/questions/"}</span>
              <input id="post-slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} className={INPUT} />
            </div>
          </div>

          {!isIdea && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <div role="tablist" aria-label="Post body" className="flex gap-1">
                  {(["edit", "preview"] as const).map((t) => (
                    <button
                      key={t}
                      role="tab"
                      aria-selected={tab === t}
                      onClick={() => setTab(t)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                        tab === t ? "bg-brand-soft text-brand-deep" : "text-muted hover:bg-inset hover:text-ink"
                      }`}
                    >
                      {t === "edit" ? "Edit" : "Preview"}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-muted">{words.toLocaleString()} words</span>
              </div>
              {tab === "edit" ? (
                <>
                  <textarea
                    aria-label="Post body"
                    rows={28}
                    value={form.body_md}
                    onChange={(e) => set("body_md", e.target.value)}
                    className={`${INPUT} font-mono text-[13px] leading-relaxed`}
                  />
                  <p className="mt-1 text-xs text-muted">
                    ## starts a section · &gt; starts a scripture or quote · **bold** · *italic* · - starts a list
                  </p>
                </>
              ) : (
                <div className="rounded-xl border border-border bg-bg px-6 py-6">
                  <ArticleMarkdown md={form.body_md} />
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="post-notes" className={LABEL}>
              Notes
            </label>
            <textarea
              id="post-notes"
              rows={4}
              value={form.reviewer_notes}
              onChange={(e) => set("reviewer_notes", e.target.value)}
              className={INPUT}
            />
            <p className="mt-1 text-xs text-muted">Never shown on the website. Say what to change when you send a post back.</p>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {!isIdea && (
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink">Before it goes live</h2>
              {problems.length === 0 ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-ok">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  Ready to publish.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {problems.map((p) => (
                    <li key={p} className="flex gap-2 text-sm text-warn">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted">
                Also check: every quote matches the sermon, scripture matches the King James Bible, and anyone named is OK being named.
              </p>
            </section>
          )}

          <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <button onClick={save} disabled={pending} className={SECONDARY}>
              {pending ? "Saving…" : saved ? "Saved" : "Save changes"}
            </button>
            {!isIdea && post.status !== "published" && (
              <>
                <button onClick={publish} disabled={pending || problems.length > 0} className={PRIMARY}>
                  Publish to the website
                </button>
                {post.status !== "needs_changes" && (
                  <button onClick={sendBack} disabled={pending} className={SECONDARY}>
                    Send back for changes
                  </button>
                )}
              </>
            )}
            {post.status === "published" && (
              <button onClick={takeDown} disabled={pending} className={SECONDARY}>
                Take off the website
              </button>
            )}
            {confirmDelete ? (
              <button
                onClick={remove}
                disabled={pending}
                className="rounded-lg bg-bad px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Delete for good?
              </button>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center justify-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-bad hover:bg-bad-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete
              </button>
            )}
          </section>

          {post.sources.length > 0 && (
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink">Answered from</h2>
              <ul className="mt-2 space-y-1 text-sm text-text">
                {post.sources.map((s) => (
                  <li key={s.sermon_id}>
                    {s.sermon ? `${s.sermon.title} · ${formatDay(s.sermon.preached_on)}` : "A sermon"}
                    {s.start_seconds !== null && <span className="text-muted"> · at {formatTimestamp(s.start_seconds)}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {segments.map((t) => (
            <section key={t.sermon_id} className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink">Sermon transcript</h2>
              <p className="text-xs text-muted">Machine transcript ({t.engine || "automatic"}). Check quotes against the recording.</p>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find words in the sermon…"
                aria-label="Search the transcript"
                className={`${INPUT} mt-3`}
              />
              <ol className="mt-3 max-h-[28rem] space-y-1.5 overflow-y-auto pr-1 text-sm">
                {t.matches.map((s, i) => (
                  <li key={`${s.start}-${i}`} className="flex gap-2">
                    <span className="w-12 shrink-0 font-mono text-xs leading-5 text-muted">{formatTimestamp(s.start)}</span>
                    <span className="text-text">{s.text}</span>
                  </li>
                ))}
                {t.matches.length === 0 && <li className="text-muted">No match.</li>}
              </ol>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}
