import { NextResponse, type NextRequest } from "next/server";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTACH_MAX_FILES, attachProblem, attachSafeName } from "@/lib/attachments";
import { stampImagePreviews } from "@/lib/roadmap";
import {
  KINDS,
  PRIORITIES,
  STATUSES,
  type RoadmapKind,
  type RoadmapPriority,
  type RoadmapStatus,
} from "@/app/(app)/admin/roadmap/constants";

export const dynamic = "force-dynamic";

/** Peer endpoint for the ONE canonical roadmap board (see lib/roadmap.ts).
 *  Non-production environments read and mutate the production board through
 *  here, authenticated by the shared SCHEMA_PEER_SECRET — the caller is the
 *  peer deployment's server, not a person. The caller already gated the
 *  human; actor identity arrives as plain text for attribution. */
function secretMatches(header: string | null): boolean {
  const expected = process.env.SCHEMA_PEER_SECRET;
  if (!expected || !header) return false;
  const given = header.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const SELECT =
  "id, title, body, kind, area, status, priority, decision_note, dev_update, dev_update_at, dev_update_needs_reply, pinned_at, pinned_until, created_at, updated_at, " +
  "requested_by_name, roadmap_comments(id, body, author_name, created_at), " +
  "roadmap_attachments(id, file_name, file_path, mime_type, size_bytes, uploaded_by_name, created_at), " +
  "roadmap_votes(voter_key, voter_name)";

type Actor = { id?: string; name?: string; email?: string };

async function logPeerActivity(
  action: string,
  entityId: string | null,
  actor: Actor,
  meta: Record<string, unknown>,
) {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("activity_log").insert({
    actor_id: null,
    action,
    detail: {
      entity: "roadmap_item",
      entity_id: entityId,
      ...meta,
      actor_name: actor.name ?? null,
      via: "peer",
    },
  });
}

export async function GET(request: NextRequest) {
  if (!secretMatches(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const { data, error } = await admin
    .from("roadmap_items")
    .select(SELECT)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await stampImagePreviews(data ?? []);
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!secretMatches(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Bad payload." }, { status: 400 });
  const actor = (body.actor ?? {}) as Actor;

  if (body.action === "create") {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ ok: false, error: "Give it a title." }, { status: 400 });
    if (!(KINDS as readonly string[]).includes(body.kind as string))
      return NextResponse.json({ ok: false, error: "Pick a type." }, { status: 400 });
    if (!(PRIORITIES as readonly string[]).includes(body.priority as string))
      return NextResponse.json({ ok: false, error: "Pick a priority." }, { status: 400 });

    const { data, error } = await admin
      .from("roadmap_items")
      .insert({
        title,
        body: typeof body.body === "string" ? body.body.trim() : "",
        kind: body.kind as RoadmapKind,
        area: typeof body.area === "string" && body.area.trim() ? body.area.trim() : "general",
        priority: body.priority as RoadmapPriority,
        requested_by: null,
        requested_by_name: actor.name ?? null,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await logPeerActivity("roadmap_item_requested", data.id, actor, { title });
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (body.action === "update") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ ok: false, error: "Missing item id." }, { status: 400 });
    if (!(STATUSES as readonly string[]).includes(body.status as string))
      return NextResponse.json({ ok: false, error: "Pick a status." }, { status: 400 });
    if (!(PRIORITIES as readonly string[]).includes(body.priority as string))
      return NextResponse.json({ ok: false, error: "Pick a priority." }, { status: 400 });
    if (!(KINDS as readonly string[]).includes(body.kind as string))
      return NextResponse.json({ ok: false, error: "Pick a type." }, { status: 400 });

    const devUpdate = typeof body.devUpdate === "string" && body.devUpdate.trim() ? body.devUpdate.trim() : null;
    const { data: before, error: readErr } = await admin
      .from("roadmap_items")
      .select("dev_update, dev_update_at")
      .eq("id", id)
      .single();
    if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
    const devChanged = (before.dev_update ?? null) !== devUpdate;

    const { data, error } = await admin
      .from("roadmap_items")
      .update({
        status: body.status as RoadmapStatus,
        priority: body.priority as RoadmapPriority,
        kind: body.kind as RoadmapKind,
        area: typeof body.area === "string" && body.area.trim() ? body.area.trim() : "general",
        decision_note:
          typeof body.decisionNote === "string" && body.decisionNote.trim() ? body.decisionNote.trim() : null,
        dev_update: devUpdate,
        dev_update_needs_reply: devUpdate ? body.devUpdateNeedsReply === true : false,
        dev_update_at: devChanged ? (devUpdate ? new Date().toISOString() : null) : before.dev_update_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("title")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await logPeerActivity("roadmap_item_updated", id, actor, { title: data.title, status: body.status });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "edit_text") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ ok: false, error: "Missing item id." }, { status: 400 });
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!title) return NextResponse.json({ ok: false, error: "Give it a title." }, { status: 400 });

    const { data: before, error: readErr } = await admin
      .from("roadmap_items")
      .select("title, body")
      .eq("id", id)
      .single();
    if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });

    const clip = (s: string) => (s.length > 400 ? `${s.slice(0, 400)}…` : s);
    const changed: { field: string; from: string; to: string }[] = [];
    if (before.title !== title) changed.push({ field: "title", from: clip(before.title as string), to: clip(title) });
    if (((before.body as string | null) ?? "") !== text)
      changed.push({ field: "body", from: clip((before.body as string | null) ?? ""), to: clip(text) });
    if (changed.length === 0) return NextResponse.json({ ok: true, changed });

    const { error } = await admin
      .from("roadmap_items")
      .update({ title, body: text, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await logPeerActivity("roadmap_item_edited", id, actor, { title, changed });
    return NextResponse.json({ ok: true, changed });
  }

  if (body.action === "comment") {
    const id = typeof body.id === "string" ? body.id : "";
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!id) return NextResponse.json({ ok: false, error: "Missing item id." }, { status: 400 });
    if (!text) return NextResponse.json({ ok: false, error: "Write something first." }, { status: 400 });

    const { error } = await admin
      .from("roadmap_comments")
      .insert({ item_id: id, body: text, author_id: null, author_name: actor.name ?? null });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await logPeerActivity("roadmap_item_commented", id, actor, {});
    return NextResponse.json({ ok: true });
  }

  if (body.action === "comment_delete") {
    const commentId = typeof body.commentId === "string" ? body.commentId : "";
    if (!commentId) return NextResponse.json({ ok: false, error: "Missing comment id." }, { status: 400 });
    const { data, error } = await admin
      .from("roadmap_comments")
      .delete()
      .eq("id", commentId)
      .select("item_id, author_name")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await logPeerActivity("roadmap_comment_deleted", data.item_id, actor, { authorName: data.author_name });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "vote") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ ok: false, error: "Missing item id." }, { status: 400 });
    const voterKey = typeof actor.id === "string" ? actor.id : "";
    if (!voterKey) return NextResponse.json({ ok: false, error: "Missing the voter's id." }, { status: 400 });

    const { data: existing, error: readErr } = await admin
      .from("roadmap_votes")
      .select("id")
      .eq("item_id", id)
      .eq("voter_key", voterKey)
      .maybeSingle();
    if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
    if (existing) {
      const { error } = await admin.from("roadmap_votes").delete().eq("id", existing.id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, voted: false });
    }
    const { error } = await admin
      .from("roadmap_votes")
      .insert({ item_id: id, voter_key: voterKey, voter_name: actor.name ?? "" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, voted: true });
  }

  if (body.action === "set_pin") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ ok: false, error: "Missing item id." }, { status: 400 });
    const days = typeof body.days === "number" ? body.days : null;
    const now = Date.now();
    const { data, error } = await admin
      .from("roadmap_items")
      .update(
        body.pinned === true
          ? { pinned_at: new Date(now).toISOString(), pinned_until: days ? new Date(now + days * 86_400_000).toISOString() : null }
          : { pinned_at: null, pinned_until: null },
      )
      .eq("id", id)
      .select("title")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await logPeerActivity("roadmap_item_pinned", id, actor, { title: data.title, pinned: body.pinned === true, days });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "attach_ticket") {
    const id = typeof body.id === "string" ? body.id : "";
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : 0;
    if (!id) return NextResponse.json({ ok: false, error: "Missing item id." }, { status: 400 });
    const problem = attachProblem(fileName, sizeBytes);
    if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });

    const { count, error: countError } = await admin
      .from("roadmap_attachments")
      .select("id", { count: "exact", head: true })
      .eq("item_id", id);
    if (countError) return NextResponse.json({ ok: false, error: countError.message }, { status: 500 });
    if ((count ?? 0) >= ATTACH_MAX_FILES)
      return NextResponse.json({ ok: false, error: `That item already holds ${ATTACH_MAX_FILES} files.` }, { status: 400 });

    const path = `roadmap/${id}/${randomUUID()}/${attachSafeName(fileName)}`;
    const { data, error } = await admin.storage.from("attachments").createSignedUploadUrl(path);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, path: data.path, signedUrl: data.signedUrl });
  }

  if (body.action === "attach_register") {
    const id = typeof body.id === "string" ? body.id : "";
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const path = typeof body.path === "string" ? body.path : "";
    const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : 0;
    if (!id) return NextResponse.json({ ok: false, error: "Missing item id." }, { status: 400 });
    if (!path.startsWith(`roadmap/${id}/`)) return NextResponse.json({ ok: false, error: "Bad storage path." }, { status: 400 });
    const problem = attachProblem(fileName, sizeBytes);
    if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });

    const { error } = await admin
      .from("roadmap_attachments")
      .insert({
        item_id: id,
        file_name: fileName,
        file_path: path,
        mime_type: typeof body.mimeType === "string" && body.mimeType ? body.mimeType : null,
        size_bytes: sizeBytes,
        uploaded_by: null,
        uploaded_by_name: actor.name ?? null,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await logPeerActivity("roadmap_item_attached", id, actor, { fileName });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "attach_download") {
    const attachmentId = typeof body.attachmentId === "string" ? body.attachmentId : "";
    if (!attachmentId) return NextResponse.json({ ok: false, error: "Missing attachment id." }, { status: 400 });
    const { data, error } = await admin
      .from("roadmap_attachments")
      .select("file_path, file_name")
      .eq("id", attachmentId)
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const { data: signed, error: signError } = await admin.storage
      .from("attachments")
      .createSignedUrl(data.file_path, 300, { download: data.file_name });
    if (signError) return NextResponse.json({ ok: false, error: signError.message }, { status: 500 });
    return NextResponse.json({ ok: true, url: signed.signedUrl });
  }

  if (body.action === "attach_delete") {
    const attachmentId = typeof body.attachmentId === "string" ? body.attachmentId : "";
    if (!attachmentId) return NextResponse.json({ ok: false, error: "Missing attachment id." }, { status: 400 });
    const { data, error } = await admin
      .from("roadmap_attachments")
      .delete()
      .eq("id", attachmentId)
      .select("item_id, file_path, file_name")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await admin.storage.from("attachments").remove([data.file_path]);
    await logPeerActivity("roadmap_attachment_deleted", data.item_id, actor, { fileName: data.file_name });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ ok: false, error: "Missing item id." }, { status: 400 });
    const { data, error } = await admin
      .from("roadmap_items")
      .delete()
      .eq("id", id)
      .select("title")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await logPeerActivity("roadmap_item_deleted", id, actor, { title: data.title });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
