"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireStaff } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { reportAndFail, reportIssue } from "@/lib/issues";
import { submitToIndexNow } from "@/lib/indexnow";
import { parsePostForm, pinProblem, postPath, publishProblems, type PostKind, type PostStatus } from "@/lib/posts";
import { siteUrl } from "@/lib/seo";

type Result = { ok: true } | { ok: false; error: string };

function refresh(kind: PostKind, slug: string, published: boolean) {
  const path = postPath(kind, slug);
  revalidatePath("/admin/posts");
  revalidatePath("/admin");
  revalidatePath(path);
  revalidatePath(kind === "sermon" ? "/sermons" : "/questions");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  if (!published || process.env.VERCEL_ENV !== "production") return;
  after(async () => {
    try {
      const base = siteUrl();
      const lists = kind === "sermon" ? [`${base}/sermons`, `${base}/`] : [`${base}/questions`];
      await submitToIndexNow(base, [`${base}${path}`, ...lists]);
    } catch (e) {
      await reportIssue({ source: "server_action", route: "posts.indexnow", message: e instanceof Error ? e.message : String(e) });
    }
  });
}

async function loadPost(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("kind, slug, status, published_at, sermon_id, sermon:sermons!posts_sermon_id_fkey(id, title, preacher)")
    .eq("id", id)
    .single();
  return { supabase, data: data as unknown as LoadedPost | null, error };
}

type LoadedPost = {
  kind: PostKind;
  slug: string;
  status: PostStatus;
  published_at: string | null;
  sermon_id: string | null;
  sermon: { id: string; title: string; preacher: string } | null;
};

/** Saves the editor's fields. A published post stays published, so its
 *  content still has to pass the publish gate. */
export async function savePost(id: string, form: Record<string, unknown>): Promise<Result> {
  const actor = await requireStaff();
  const { supabase, data: post, error: readErr } = await loadPost(id);
  if (readErr || !post) {
    return reportAndFail(
      { source: "server_action", route: "posts.save", message: readErr?.message ?? "post not found", errorCode: readErr?.code, userId: actor.id },
      "Couldn't find that post.",
    );
  }
  const parsed = parsePostForm(post.kind, form);
  if (!parsed.ok) return parsed;
  if (post.status === "published") {
    const problems = publishProblems({ kind: post.kind, ...parsed.value, sermon: post.sermon });
    if (problems.length) return { ok: false, error: `This post is on the website, so it has to stay ready: ${problems[0]}` };
  }

  const { error } = await supabase.from("posts").update(parsed.value).eq("id", id).select("id").single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Another post already uses that web address." };
    return reportAndFail(
      { source: "server_action", route: "posts.save", message: error.message, errorCode: error.code, userId: actor.id },
      "Couldn't save that post.",
    );
  }
  await logActivity(actor.id, "post_updated", { id, title: parsed.value.title });
  refresh(post.kind, parsed.value.slug, post.status === "published");
  if (post.slug !== parsed.value.slug) revalidatePath(postPath(post.kind, post.slug));
  return { ok: true };
}

/** Publish (runs the gate, shows the sermon too), take down, or send back. */
export async function setPostStatus(id: string, status: "published" | "draft" | "needs_changes"): Promise<Result> {
  const actor = await requireStaff();
  const { supabase, data: post, error: readErr } = await loadPost(id);
  if (readErr || !post) {
    return reportAndFail(
      { source: "server_action", route: "posts.status", message: readErr?.message ?? "post not found", errorCode: readErr?.code, userId: actor.id },
      "Couldn't find that post.",
    );
  }
  if (post.status === "idea") return { ok: false, error: "A sermon idea has no post to publish yet." };

  if (status === "published") {
    const { data: content, error } = await supabase
      .from("posts")
      .select("title, description, question, body_md")
      .eq("id", id)
      .single();
    if (error) {
      return reportAndFail(
        { source: "server_action", route: "posts.publish", message: error.message, errorCode: error.code, userId: actor.id },
        "Couldn't read that post.",
      );
    }
    const problems = publishProblems({ kind: post.kind, ...content, sermon: post.sermon });
    if (problems.length) return { ok: false, error: problems.join(" ") };
  }

  const { error } = await supabase
    .from("posts")
    .update({
      status,
      published_at: status === "published" ? (post.published_at ?? new Date().toISOString()) : post.published_at,
      ...(status === "published" ? {} : { pinned_at: null }),
      reviewed_by: actor.id,
    })
    .eq("id", id)
    .select("id")
    .single();
  if (error) {
    return reportAndFail(
      { source: "server_action", route: "posts.status", message: error.message, errorCode: error.code, userId: actor.id },
      "Couldn't update that post.",
    );
  }
  // The post goes live first; its sermon card follows. If this half fails the
  // post still renders (it reads the sermon only when published).
  if (status === "published" && post.kind === "sermon" && post.sermon_id) {
    const { error: sErr } = await supabase.from("sermons").update({ published: true }).eq("id", post.sermon_id).select("id").single();
    if (sErr) {
      refresh(post.kind, post.slug, true);
      return reportAndFail(
        { source: "server_action", route: "posts.publish.sermon", message: sErr.message, errorCode: sErr.code, userId: actor.id },
        "The post is published, but its sermon is still hidden. On the Sermons page, tick “Show on the website” for it.",
      );
    }
  }
  await logActivity(actor.id, `post_${status}`, { id, slug: post.slug });
  refresh(post.kind, post.slug, status === "published" || post.status === "published");
  return { ok: true };
}

/** Pin a published post to the top of its list (and the home page, for a
 *  sermon), or unpin it. */
export async function setPostPinned(id: string, pinned: boolean): Promise<Result> {
  const actor = await requireStaff();
  const { supabase, data: post, error: readErr } = await loadPost(id);
  if (readErr || !post) {
    return reportAndFail(
      { source: "server_action", route: "posts.pin", message: readErr?.message ?? "post not found", errorCode: readErr?.code, userId: actor.id },
      "Couldn't find that post.",
    );
  }

  if (pinned) {
    const { count, error } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("kind", post.kind)
      .not("pinned_at", "is", null)
      .neq("id", id);
    if (error) {
      return reportAndFail(
        { source: "server_action", route: "posts.pin", message: error.message, errorCode: error.code, userId: actor.id },
        "Couldn't check which posts are pinned.",
      );
    }
    const problem = pinProblem(post.kind, post.status, count ?? 0);
    if (problem) return { ok: false, error: problem };
  }

  const { error } = await supabase
    .from("posts")
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id")
    .single();
  if (error) {
    return reportAndFail(
      { source: "server_action", route: "posts.pin", message: error.message, errorCode: error.code, userId: actor.id },
      pinned ? "Couldn't pin that post." : "Couldn't unpin that post.",
    );
  }
  await logActivity(actor.id, pinned ? "post_pinned" : "post_unpinned", { id, slug: post.slug });
  refresh(post.kind, post.slug, true);
  return { ok: true };
}

export async function deletePost(id: string): Promise<Result> {
  const actor = await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("posts").delete().eq("id", id).select("kind, slug, status").single();
  if (error) {
    return reportAndFail(
      { source: "server_action", route: "posts.delete", message: error.message, errorCode: error.code, userId: actor.id },
      "Couldn't delete that post.",
    );
  }
  await logActivity(actor.id, "post_deleted", { id, slug: data.slug });
  refresh(data.kind as PostKind, data.slug as string, data.status === "published");
  return { ok: true };
}

/** The reviewer's one-tap answer to "who preached this?" on a sermon post. */
export async function setSermonPreacher(sermonId: string, preacher: string): Promise<Result> {
  const actor = await requireStaff();
  const name = preacher.trim();
  if (!name) return { ok: false, error: "Enter who preached this sermon." };
  if (name.length > 200) return { ok: false, error: "That name is too long." };
  const supabase = await createClient();
  const { error } = await supabase.from("sermons").update({ preacher: name }).eq("id", sermonId).select("id").single();
  if (error) {
    return reportAndFail(
      { source: "server_action", route: "posts.preacher", message: error.message, errorCode: error.code, userId: actor.id },
      "Couldn't save who preached this sermon.",
    );
  }
  await logActivity(actor.id, "sermons_updated", { id: sermonId, preacher: name });
  revalidatePath("/admin/posts");
  revalidatePath("/admin/sermons");
  return { ok: true };
}
