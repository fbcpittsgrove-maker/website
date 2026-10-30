import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicSermon } from "@/lib/content-server";
import { MAX_PINNED, type PostKind, type PostStatus } from "@/lib/posts";

/** posts → sermons is reached two ways (posts.sermon_id and post_sources), so
 *  the direct embed names its foreign key. */
const OWN_SERMON = "sermon:sermons!posts_sermon_id_fkey";

export type PostSermon = { id: string; title: string; preacher: string; preached_on: string; scripture: string; published: boolean };

export type AdminPostRow = {
  id: string;
  kind: PostKind;
  slug: string;
  title: string;
  question: string;
  status: PostStatus;
  updated_at: string;
  published_at: string | null;
  pinned_at: string | null;
  sermon: Pick<PostSermon, "title" | "preached_on"> | null;
};

export type PostSource = { sermon_id: string; start_seconds: number | null; sermon: Pick<PostSermon, "title" | "preached_on"> | null };
export type Transcript = { sermon_id: string; body: string; segments: { start: number; text: string }[]; engine: string };

export type AdminPost = {
  id: string;
  kind: PostKind;
  slug: string;
  title: string;
  description: string;
  question: string;
  body_md: string;
  reviewer_notes: string;
  status: PostStatus;
  published_at: string | null;
  pinned_at: string | null;
  updated_at: string;
  sermon: PostSermon | null;
  sources: PostSource[];
  transcripts: Transcript[];
};

/** Every post for the review list (RLS: active members only). */
export async function listPosts(): Promise<AdminPostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(`id, kind, slug, title, question, status, updated_at, published_at, pinned_at, ${OWN_SERMON}(title, preached_on)`)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Posts read failed — ${error.message}`);
  return data as unknown as AdminPostRow[];
}

export async function postsAwaitingReview(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "draft");
  if (error) throw new Error(`Posts count failed — ${error.message}`);
  return count ?? 0;
}

/** One post with what the reviewer checks it against: its sermon, the
 *  sermons it draws from, and their transcripts. Null when not found. */
export async function getPost(id: string): Promise<AdminPost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      `id, kind, slug, title, description, question, body_md, reviewer_notes, status, published_at, pinned_at, updated_at, ` +
        `${OWN_SERMON}(id, title, preacher, preached_on, scripture, published), ` +
        `sources:post_sources(sermon_id, start_seconds, sermon:sermons(title, preached_on))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Post read failed — ${error.message}`);
  if (!data) return null;
  const post = data as unknown as Omit<AdminPost, "transcripts">;

  const sermonIds = [...new Set([post.sermon?.id, ...post.sources.map((s) => s.sermon_id)].filter((v): v is string => !!v))];
  if (sermonIds.length === 0) return { ...post, transcripts: [] };
  const { data: transcripts, error: tErr } = await supabase
    .from("sermon_transcripts")
    .select("sermon_id, body, segments, engine")
    .in("sermon_id", sermonIds);
  if (tErr) throw new Error(`Transcript read failed — ${tErr.message}`);
  return { ...post, transcripts: transcripts as Transcript[] };
}

// ============================================================ public site

export type PublicPostSummary = {
  id: string;
  kind: PostKind;
  slug: string;
  title: string;
  description: string;
  question: string;
  published_at: string;
  sermon: Pick<PostSermon, "title" | "preacher" | "preached_on" | "scripture"> | null;
};

export type PublicPost = PublicPostSummary & {
  body_md: string;
  updated_at: string;
  /** Sermon posts this page draws from (question pages). */
  fromSermons: { slug: string; title: string; preached_on: string; start_seconds: number | null }[];
  /** Question pages answered from this sermon (sermon posts). */
  questions: { slug: string; title: string; question: string }[];
};

const SUMMARY = `id, kind, slug, title, description, question, published_at, ${OWN_SERMON}(title, preacher, preached_on, scripture)`;

export async function publishedPosts(kind: PostKind, limit = 200): Promise<PublicPostSummary[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select(SUMMARY)
    .eq("kind", kind)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Public posts read failed — ${error.message}`);
  return data as unknown as PublicPostSummary[];
}

export type PinnedPost = {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** The full sermon card for sermon posts; null for question pages. */
  sermon: PublicSermon | null;
};

/** Pinned posts of one kind, newest pin first. A sermon post whose sermon
 *  is hidden is left out — its card has nothing to show. */
export async function pinnedPosts(kind: PostKind): Promise<PinnedPost[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select(`id, slug, title, description, ${OWN_SERMON}(id, title, preacher, preached_on, scripture, summary, video_url, audio_url)`)
    .eq("kind", kind)
    .not("pinned_at", "is", null)
    .order("pinned_at", { ascending: false })
    .limit(MAX_PINNED);
  if (error) throw new Error(`Pinned posts read failed — ${error.message}`);
  return (data as unknown as PinnedPost[]).filter((p) => kind === "question" || p.sermon);
}

/** Published sermon post slug per sermon id — the sermon cards link to them. */
export async function sermonPostSlugs(): Promise<Map<string, string>> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("posts").select("slug, sermon_id").eq("kind", "sermon").not("sermon_id", "is", null);
  if (error) throw new Error(`Sermon post slugs read failed — ${error.message}`);
  return new Map((data as { slug: string; sermon_id: string }[]).map((r) => [r.sermon_id, r.slug]));
}

export async function publishedPost(kind: PostKind, slug: string): Promise<PublicPost | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select(`${SUMMARY}, body_md, updated_at, sermon_id, sources:post_sources(sermon_id, start_seconds)`)
    .eq("kind", kind)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Public post read failed — ${error.message}`);
  if (!data) return null;
  const { sermon_id, sources, ...post } = data as unknown as PublicPostSummary & {
    body_md: string;
    updated_at: string;
    sermon_id: string | null;
    sources: { sermon_id: string; start_seconds: number | null }[];
  };

  let fromSermons: PublicPost["fromSermons"] = [];
  if (sources.length) {
    const { data: sermonPosts, error: sErr } = await supabase
      .from("posts")
      .select(`slug, title, sermon_id, ${OWN_SERMON}(preached_on)`)
      .eq("kind", "sermon")
      .in("sermon_id", sources.map((s) => s.sermon_id));
    if (sErr) throw new Error(`Source sermon posts read failed — ${sErr.message}`);
    fromSermons = (sermonPosts as unknown as { slug: string; title: string; sermon_id: string; sermon: { preached_on: string } | null }[])
      .filter((p) => p.sermon)
      .map((p) => ({
        slug: p.slug,
        title: p.title,
        preached_on: p.sermon!.preached_on,
        start_seconds: sources.find((s) => s.sermon_id === p.sermon_id)?.start_seconds ?? null,
      }));
  }

  let questions: PublicPost["questions"] = [];
  if (kind === "sermon" && sermon_id) {
    const { data: rows, error: qErr } = await supabase
      .from("post_sources")
      .select("post:posts!inner(slug, title, question, kind)")
      .eq("sermon_id", sermon_id);
    if (qErr) throw new Error(`Sermon questions read failed — ${qErr.message}`);
    questions = (rows as unknown as { post: { slug: string; title: string; question: string; kind: PostKind } }[])
      .filter((r) => r.post.kind === "question")
      .map(({ post: p }) => ({ slug: p.slug, title: p.title, question: p.question }));
  }

  return { ...post, fromSermons, questions };
}
