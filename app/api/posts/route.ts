import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { SLUG_RE, parseDraftFile, type DraftFile, type PostKind } from "@/lib/posts";

export const dynamic = "force-dynamic";

/** Import endpoint for sermon blog drafts written off-site (transcribe →
 *  draft in Claude Code → scripts/import-sermon.mjs). Authenticated by the
 *  shared SCHEMA_PEER_SECRET. It only ever stages: new posts land as drafts
 *  (or sermon ideas), a sermon idea becomes a draft once a sermon answers it,
 *  a `link: only` file adds this sermon as a source of an existing question
 *  page, an existing unpublished post is replaced only when the caller asks
 *  (`replace`), and a published post's text is never touched.
 *  Publishing is a person's job in /admin. */
function secretMatches(header: string | null): boolean {
  const expected = process.env.SCHEMA_PEER_SECRET;
  if (!expected || !header) return false;
  const given = header.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Segment = { start: number; text: string };
type Payload = {
  sermon: string;
  questions: { file: string; start_seconds: number | null }[];
  transcript: { body: string; segments: Segment[]; engine: string } | null;
  /** Overwrite existing unpublished drafts (a revised draft after "Send
   *  back"). Without it an existing post is left as the editor left it. */
  replace: boolean;
};

class ImportError extends Error {}

type Staged = {
  kind: PostKind;
  label: string;
  slug: string;
  status: "idea" | "draft";
  startSeconds: number | null;
  /** `link: only` — this sermon also answers an existing question page: add
   *  it as a source and leave the page's text to the editor. */
  linkOnly: boolean;
  fields: { title: string; description: string; question: string; body_md: string; reviewer_notes: string };
};

function need(draft: DraftFile, key: string, file: string): string {
  const v = draft.meta[key]?.trim();
  if (!v) throw new ImportError(`${file}: front matter is missing "${key}"`);
  return v;
}

/** A malformed draft file is the caller's mistake (400), not a server fault. */
function parseDraft(text: string, label: string): DraftFile {
  try {
    return parseDraftFile(text);
  } catch (e) {
    throw new ImportError(`${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** One draft checked and shaped for a write. Throws before anything is written. */
function toStaged(draft: DraftFile, kind: PostKind, startSeconds: number | null): Staged {
  const label = kind === "sermon" ? "sermon post" : `question "${draft.meta.slug ?? "?"}"`;
  if (draft.meta.kind !== kind) throw new ImportError(`${label}: kind must be ${kind}`);
  const slug = need(draft, "slug", label);
  if (!SLUG_RE.test(slug) || slug.length > 80) throw new ImportError(`${label}: bad slug ${slug}`);
  if (draft.meta.link !== undefined && draft.meta.link !== "only") throw new ImportError(`${label}: link must be "only"`);
  if (draft.meta.link === "only") {
    if (kind !== "question") throw new ImportError(`${label}: only a question page can be linked`);
    return {
      kind,
      label,
      slug,
      status: "draft",
      startSeconds,
      linkOnly: true,
      fields: { title: "", description: "", question: "", body_md: "", reviewer_notes: "" },
    };
  }
  const status = draft.meta.status === "idea" ? "idea" : "draft";
  if (status === "idea" && kind !== "question") throw new ImportError(`${label}: only a question can be an idea`);
  if (status === "draft" && !draft.body) throw new ImportError(`${label}: draft has no body`);
  return {
    kind,
    label,
    slug,
    status,
    startSeconds,
    linkOnly: false,
    fields: {
      title: need(draft, "title", label),
      description: draft.meta.description ?? "",
      question: kind === "question" ? need(draft, "question", label) : "",
      body_md: draft.body,
      reviewer_notes: draft.notes,
    },
  };
}

function parsePayload(body: Record<string, unknown>): Payload {
  if (typeof body.sermon !== "string") throw new ImportError("sermon must be the sermon post's markdown");
  if (!Array.isArray(body.questions)) throw new ImportError("questions must be an array");
  const questions = body.questions.map((q, i) => {
    const r = q as Record<string, unknown>;
    if (typeof r?.file !== "string") throw new ImportError(`questions[${i}].file must be markdown`);
    const s = r.start_seconds;
    if (s !== null && s !== undefined && !(typeof s === "number" && Number.isInteger(s) && s >= 0)) {
      throw new ImportError(`questions[${i}].start_seconds must be a whole number of seconds`);
    }
    return { file: r.file, start_seconds: typeof s === "number" ? s : null };
  });
  let transcript: Payload["transcript"] = null;
  if (body.transcript !== null && body.transcript !== undefined) {
    const t = body.transcript as Record<string, unknown>;
    if (typeof t.body !== "string" || !t.body.trim()) throw new ImportError("transcript.body must be text");
    if (!Array.isArray(t.segments)) throw new ImportError("transcript.segments must be an array");
    const segments = t.segments.map((seg, i) => {
      const r = seg as Record<string, unknown>;
      if (typeof r?.start !== "number" || typeof r?.text !== "string") throw new ImportError(`transcript.segments[${i}] needs start + text`);
      return { start: r.start, text: r.text };
    });
    transcript = { body: t.body, segments, engine: typeof t.engine === "string" ? t.engine : "" };
  }
  if (body.replace !== undefined && typeof body.replace !== "boolean") throw new ImportError("replace must be true or false");
  return { sermon: body.sermon, questions, transcript, replace: body.replace === true };
}

export async function POST(request: NextRequest) {
  if (!secretMatches(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || raw.action !== "import") return NextResponse.json({ ok: false, error: "Bad payload." }, { status: 400 });

  try {
    // Validate every draft before writing anything.
    const payload = parsePayload(raw);
    const sermonDraft = parseDraft(payload.sermon, "sermon post");
    const sermonPost = toStaged(sermonDraft, "sermon", null);
    const preachedOn = need(sermonDraft, "preached_on", "sermon post");
    if (!DATE_RE.test(preachedOn)) throw new ImportError("sermon post: preached_on must be YYYY-MM-DD");
    const sermonTitle = need(sermonDraft, "sermon_title", "sermon post");
    const questions = payload.questions.map((q, i) => toStaged(parseDraft(q.file, `questions[${i}]`), "question", q.start_seconds));
    const slugs = [sermonPost, ...questions].map((p) => p.slug);
    const dupe = slugs.find((s, i) => slugs.indexOf(s) !== i);
    if (dupe) throw new ImportError(`two drafts use the slug ${dupe}`);

    // The sermon: the one its post already points at, else matched on day +
    // title, else created unpublished.
    const { data: bySlug, error: bySlugErr } = await admin
      .from("posts")
      .select("kind, sermon_id")
      .eq("slug", sermonPost.slug)
      .maybeSingle();
    if (bySlugErr) throw new Error(`sermon post lookup failed — ${bySlugErr.message}`);
    if (bySlug && bySlug.kind !== "sermon") throw new ImportError(`sermon post: slug ${sermonPost.slug} belongs to a question page`);
    let sermonId = (bySlug?.sermon_id as string | null | undefined) ?? null;
    if (!sermonId) {
      const { data: existing, error: findErr } = await admin
        .from("sermons")
        .select("id")
        .eq("preached_on", preachedOn)
        .eq("title", sermonTitle)
        .maybeSingle();
      if (findErr) throw new Error(`sermon lookup failed — ${findErr.message}`);
      sermonId = (existing?.id as string | undefined) ?? null;
    }
    if (!sermonId) {
      const { data: created, error } = await admin
        .from("sermons")
        .insert({
          title: sermonTitle,
          preached_on: preachedOn,
          preacher: sermonDraft.meta.preacher ?? "",
          scripture: sermonDraft.meta.scripture ?? "",
          summary: sermonDraft.meta.description ?? "",
          published: false,
        })
        .select("id")
        .single();
      if (error) throw new Error(`sermon insert failed — ${error.message}`);
      sermonId = created.id as string;
    }
    const sermon = sermonId;

    if (payload.transcript) {
      const { data: had, error: tErr } = await admin.from("sermon_transcripts").select("sermon_id").eq("sermon_id", sermon).maybeSingle();
      if (tErr) throw new Error(`transcript lookup failed — ${tErr.message}`);
      if (!had || payload.replace) {
        const { error } = await admin
          .from("sermon_transcripts")
          .upsert({ sermon_id: sermon, ...payload.transcript }, { onConflict: "sermon_id" });
        if (error) throw new Error(`transcript save failed — ${error.message}`);
      }
    }

    const results: { slug: string; outcome: "created" | "replaced" | "answered_idea" | "linked" | "skipped_exists" | "skipped_published" }[] = [];
    const linkSource = async (post: Staged, postId: string) => {
      const { error } = await admin
        .from("post_sources")
        .upsert({ post_id: postId, sermon_id: sermon, start_seconds: post.startSeconds }, { onConflict: "post_id,sermon_id" });
      if (error) throw new Error(`${post.label}: source link failed — ${error.message}`);
    };
    const stage = async (post: Staged) => {
      // A sermon's post is found by its sermon, so a changed slug updates it
      // rather than colliding with posts_one_per_sermon.
      let found: { id: string; kind: string; status: string } | null = null;
      if (post.kind === "sermon") {
        const { data, error } = await admin
          .from("posts")
          .select("id, kind, status")
          .eq("kind", "sermon")
          .eq("sermon_id", sermon)
          .maybeSingle();
        if (error) throw new Error(`${post.label}: lookup failed — ${error.message}`);
        found = data;
      }
      if (!found) {
        const { data, error } = await admin.from("posts").select("id, kind, status").eq("slug", post.slug).maybeSingle();
        if (error) throw new Error(`${post.label}: lookup failed — ${error.message}`);
        if (data && data.kind !== post.kind) throw new ImportError(`${post.label}: slug ${post.slug} belongs to a ${data.kind} post`);
        found = data;
      }

      if (post.linkOnly) {
        if (!found) throw new ImportError(`${post.label}: link: only, but no question page has this slug`);
        if (found.status === "idea") throw new ImportError(`${post.label}: is still a sermon idea; send a full draft to answer it`);
        await linkSource(post, found.id);
        results.push({ slug: post.slug, outcome: "linked" });
        return;
      }
      if (found?.status === "published") {
        results.push({ slug: post.slug, outcome: "skipped_published" });
        return;
      }
      // A sermon idea has no text anyone edited: the first draft that
      // answers it takes its place.
      const answersIdea = found?.status === "idea" && post.status === "draft";
      if (found && !payload.replace && !answersIdea) {
        results.push({ slug: post.slug, outcome: "skipped_exists" });
        return;
      }
      let postId: string;
      if (found) {
        const { error } = await admin
          .from("posts")
          .update({ ...post.fields, slug: post.slug, status: post.status })
          .eq("id", found.id);
        if (error) throw new Error(`${post.label}: update failed — ${error.message}`);
        postId = found.id;
        results.push({ slug: post.slug, outcome: answersIdea ? "answered_idea" : "replaced" });
      } else {
        const { data: created, error } = await admin
          .from("posts")
          .insert({ ...post.fields, kind: post.kind, slug: post.slug, status: post.status, sermon_id: post.kind === "sermon" ? sermon : null })
          .select("id")
          .single();
        if (error) throw new Error(`${post.label}: insert failed — ${error.message}`);
        postId = created.id as string;
        results.push({ slug: post.slug, outcome: "created" });
      }
      if (post.kind === "question" && post.status !== "idea") await linkSource(post, postId);
    };

    await stage(sermonPost);
    for (const q of questions) await stage(q);

    await logActivity(null, "posts_imported", { sermon_id: sermon, results, via: "peer" });
    return NextResponse.json({ ok: true, sermon_id: sermon, results });
  } catch (e) {
    const status = e instanceof ImportError ? 400 : 500;
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
