"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleAlert, ExternalLink, MessageSquareText, Pencil, Pin, PinOff, Trash2, X } from "lucide-react";
import { deletePost, savePost, setPostPinned, setPostStatus, setSermonPreacher } from "@/app/(app)/admin/posts/actions";
import { ArticleMarkdown } from "@/lib/article-markdown";
import { CHURCH } from "@/lib/church";
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
  "rounded-lg bg-action px-4 py-2.5 text-sm font-semibold text-on-brand hover:bg-action-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const SECONDARY =
  "rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-inset disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const PREACHERS = CHURCH.leaders.map((l) => `${l.title} ${l.name}`);
const UNCONFIRMED = /\bCONFIRM\b/;

function Count({ n, range }: { n: number; range: { min: number; max: number } }) {
  const ok = n >= range.min && n <= range.max;
  return (
    <span className={`font-normal normal-case tracking-normal ${ok ? "text-ok" : "text-warn"}`}>
      {n} / {range.min}–{range.max}
    </span>
  );
}

/** "Who preached this?" — one tap to settle the preacher, so a sermon post's
 *  only publish blocker never sends the reviewer to another page. */
function PreacherPicker({ sermonId, current, onDone }: { sermonId: string; current: string; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pick = (name: string) =>
    startTransition(async () => {
      setError(null);
      const r = await setSermonPreacher(sermonId, name);
      if (!r.ok) setError(r.error);
      else onDone();
    });
  return (
    <section className="rounded-xl border border-warn-line bg-warn-soft p-4">
      <h2 className="text-sm font-semibold text-ink">Who preached this sermon?</h2>
      {current && <p className="mt-1 text-xs text-muted">Best guess: {current.replace(/^CONFIRM:\s*/, "")}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {PREACHERS.map((name) => (
          <button key={name} disabled={pending} onClick={() => pick(name)} className={SECONDARY}>
            {name}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          pick(other);
        }}
        className="mt-3 flex gap-2"
      >
        <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Someone else…" aria-label="Someone else" className={INPUT} />
        <button type="submit" disabled={pending || !other.trim()} className={SECONDARY}>
          Save
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </section>
  );
}

/** Steven's review screen, phone first: the post opens as readers will see
 *  it, a sticky bar carries Approve / Request changes / Edit, and change
 *  requests are typed into a pop-up note. */
export function PostEditor({ post }: { post: AdminPost }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<PostForm>({
    title: post.title,
    slug: post.slug,
    description: post.description,
    question: post.question,
    body_md: post.body_md,
    reviewer_notes: post.reviewer_notes,
  });
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const isIdea = post.status === "idea";
  const isLive = post.status === "published";
  const isPinned = !!post.pinned_at;
  const problems = publishProblems({ kind: post.kind, ...form, sermon: post.sermon });
  const needsPreacher = post.kind === "sermon" && !!post.sermon && (!post.sermon.preacher.trim() || UNCONFIRMED.test(post.sermon.preacher));
  const words = wordCount(form.body_md);

  const segments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return post.transcripts.map((t) => ({
      ...t,
      matches: q ? t.segments.filter((s) => s.text.toLowerCase().includes(q)) : t.segments,
    }));
  }, [post.transcripts, search]);

  useEffect(() => {
    if (!noteOpen) return;
    noteRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNoteOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [noteOpen]);

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
    run(
      async () => {
        const s = await savePost(post.id, form);
        return s.ok ? setPostStatus(post.id, "published") : s;
      },
      () => setConfirmPublish(false),
    );
  const requestChanges = () => {
    const stamp = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date());
    const notes = [`Change request (${stamp}): ${note.trim()}`, form.reviewer_notes].filter(Boolean).join("\n\n");
    run(
      async () => {
        const s = await savePost(post.id, { ...form, reviewer_notes: notes });
        return s.ok ? setPostStatus(post.id, "needs_changes") : s;
      },
      () => {
        set("reviewer_notes", notes);
        setNote("");
        setNoteOpen(false);
      },
    );
  };
  const takeDown = () => run(() => setPostStatus(post.id, "draft"));
  const togglePin = () => run(() => setPostPinned(post.id, !isPinned));
  const remove = () =>
    run(
      () => deletePost(post.id),
      () => router.push("/admin/posts"),
    );

  const publishButton = confirmPublish ? (
    <button onClick={publish} disabled={pending} className={`${PRIMARY} flex-1`}>
      {pending ? "Publishing…" : "Yes, publish it"}
    </button>
  ) : (
    <button onClick={() => setConfirmPublish(true)} disabled={pending || problems.length > 0} className={`${PRIMARY} flex-1`}>
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Approve & publish
      </span>
    </button>
  );

  return (
    <div className="mx-auto max-w-6xl pb-28 lg:pb-0">
      <Link href="/admin/posts" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All posts
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {POST_KIND_LABEL[post.kind]} · {POST_STATUS_LABEL[post.status]}
            {isPinned && " · Pinned"}
          </p>
          {post.sermon && (
            <p className="mt-1 text-sm text-muted">
              From “{post.sermon.title}” · {formatDay(post.sermon.preached_on)}
              {!needsPreacher && post.sermon.preacher ? ` · ${post.sermon.preacher}` : ""}
            </p>
          )}
        </div>
        {isLive && (
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

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {needsPreacher && post.sermon && (
            <PreacherPicker sermonId={post.sermon.id} current={post.sermon.preacher} onDone={() => router.refresh()} />
          )}

          {post.reviewer_notes && (
            <details className="rounded-xl border border-accent-line bg-accent-soft p-4" open={post.status === "needs_changes"}>
              <summary className="cursor-pointer text-sm font-semibold text-ink">Notes on this post</summary>
              <p className="mt-2 whitespace-pre-line text-sm text-text">{post.reviewer_notes}</p>
            </details>
          )}

          {isIdea ? (
            <section className="rounded-xl border border-border bg-surface p-5">
              <h1 className="font-display text-2xl font-semibold text-ink">{post.question}</h1>
              <p className="mt-2 text-sm text-muted">
                A question people search for that no sermon has answered yet. When a sermon answers it, a draft will appear here to review.
              </p>
            </section>
          ) : (
            <>
              <div role="tablist" aria-label="Post view" className="flex gap-1">
                {(["read", "edit"] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={mode === t}
                    onClick={() => setMode(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      mode === t ? "bg-brand-soft text-brand-deep" : "text-muted hover:bg-inset hover:text-ink"
                    }`}
                  >
                    {t === "read" ? "Read" : "Edit"}
                  </button>
                ))}
                <span className="ml-auto self-center text-xs text-muted">{words.toLocaleString()} words</span>
              </div>

              {mode === "read" ? (
                <article className="rounded-xl border border-border bg-bg px-5 py-6 md:px-8 md:py-8">
                  <h1 className="font-display text-3xl font-semibold leading-tight text-ink md:text-4xl">{form.title}</h1>
                  <div className="mt-6">
                    <ArticleMarkdown md={form.body_md} />
                  </div>
                </article>
              ) : (
                <div className="space-y-4">
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
                      rows={3}
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                      className={INPUT}
                    />
                    <p className="mt-1 text-xs text-muted">Shown under the title in Google and when the link is shared.</p>
                  </div>
                  {post.kind === "question" && (
                    <div>
                      <label htmlFor="post-question" className={LABEL}>
                        Question
                      </label>
                      <input id="post-question" value={form.question} onChange={(e) => set("question", e.target.value)} className={INPUT} />
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
                  <div>
                    <label htmlFor="post-body" className={LABEL}>
                      Post
                    </label>
                    <textarea
                      id="post-body"
                      rows={24}
                      value={form.body_md}
                      onChange={(e) => set("body_md", e.target.value)}
                      className={`${INPUT} font-mono text-[13px] leading-relaxed`}
                    />
                    <p className="mt-1 text-xs text-muted">
                      ## starts a section · &gt; starts a scripture or quote · **bold** · *italic* · - starts a list
                    </p>
                  </div>
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
                    <p className="mt-1 text-xs text-muted">Never shown on the website.</p>
                  </div>
                  <button onClick={save} disabled={pending} className={SECONDARY}>
                    {pending ? "Saving…" : saved ? "Saved" : "Save changes"}
                  </button>
                </div>
              )}
            </>
          )}
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

          <section className="hidden flex-col gap-2 rounded-xl border border-border bg-surface p-4 lg:flex">
            {!isIdea && !isLive && (
              <>
                {publishButton}
                <button onClick={() => setNoteOpen(true)} disabled={pending} className={SECONDARY}>
                  Request changes
                </button>
              </>
            )}
            {isLive && (
              <>
                <button onClick={togglePin} disabled={pending} className={isPinned ? SECONDARY : PRIMARY}>
                  <span className="inline-flex items-center gap-1.5">
                    {isPinned ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />}
                    {isPinned ? "Unpin" : "Pin to the top"}
                  </span>
                </button>
                <p className="text-xs text-muted">
                  {post.kind === "sermon"
                    ? "Pinned sermons are featured at the top of the Sermons page and on the home page."
                    : "Pinned questions are featured at the top of the Bible Questions page."}
                </p>
                <button onClick={takeDown} disabled={pending} className={SECONDARY}>
                  Take off the website
                </button>
              </>
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
            <details key={t.sermon_id} className="rounded-xl border border-border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink">Sermon transcript</summary>
              <p className="mt-1 text-xs text-muted">Machine transcript ({t.engine || "automatic"}). Check quotes against the recording.</p>
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
            </details>
          ))}

          {/* Phone: delete lives at the foot of the page, out of thumb's way. */}
          <div className="lg:hidden">
            {confirmDelete ? (
              <button onClick={remove} disabled={pending} className="w-full rounded-lg bg-bad px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                Delete for good?
              </button>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg px-4 py-2.5 text-sm font-medium text-bad hover:bg-bad-soft"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete this post
              </button>
            )}
          </div>
        </aside>
      </div>

      {!isIdea && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          {problems.length > 0 && !isLive && <p className="mb-2 text-xs text-warn">{problems[0]}</p>}
          <div className="flex gap-2">
            {isLive ? (
              <>
                <button onClick={takeDown} disabled={pending} className={`${SECONDARY} flex-1`}>
                  Take off the website
                </button>
                <button onClick={togglePin} disabled={pending} aria-label={isPinned ? "Unpin" : "Pin to the top"} className={SECONDARY}>
                  {isPinned ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />}
                </button>
              </>
            ) : (
              <>
                {publishButton}
                <button onClick={() => setNoteOpen(true)} disabled={pending} aria-label="Request changes" className={SECONDARY}>
                  <MessageSquareText className="h-4 w-4" aria-hidden />
                </button>
              </>
            )}
            <button
              onClick={() => setMode(mode === "read" ? "edit" : "read")}
              aria-label={mode === "read" ? "Edit" : "Read"}
              className={SECONDARY}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {noteOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setNoteOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="note-title" className="text-base font-semibold text-ink">
                What should change?
              </h2>
              <button onClick={() => setNoteOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-inset hover:text-ink">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">The post goes back for a new draft with your note. Nothing is published.</p>
            <textarea
              ref={noteRef}
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Use the full verse in the second section, and leave out the story about the dog."
              aria-label="Your note"
              className={`${INPUT} mt-3`}
            />
            <div className="mt-4 flex gap-2">
              <button onClick={requestChanges} disabled={pending || !note.trim()} className={`${PRIMARY} flex-1`}>
                {pending ? "Sending…" : "Send back with note"}
              </button>
              <button onClick={() => setNoteOpen(false)} className={SECONDARY}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
