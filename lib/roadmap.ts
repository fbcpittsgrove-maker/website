import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportAndFail, reportIssue } from "@/lib/issues";
import { peerConfigured, peerFetch } from "@/lib/peer";
import { ATTACH_MAX_FILES, attachIsImage, attachProblem, attachSafeName } from "@/lib/attachments";
import type { RoadmapKind, RoadmapPriority, RoadmapStatus } from "@/app/(app)/admin/roadmap/constants";

/**
 * Roadmap data layer — ONE canonical board for the whole product.
 *
 * The production database owns roadmap_items, and it is the ONLY copy.
 * Production reads and writes its own DB; every other environment proxies
 * through prod's /api/roadmap (SCHEMA_PEER_URL + SCHEMA_PEER_SECRET).
 * An environment with no peer gets an error, never its own data.
 */

export type RoadmapItem = {
  id: string;
  title: string;
  body: string;
  kind: RoadmapKind;
  area: string;
  status: RoadmapStatus;
  priority: RoadmapPriority;
  decisionNote: string | null;
  devUpdate: string | null;
  devUpdateAt: string | null;
  devUpdateNeedsReply: boolean;
  createdAt: string;
  updatedAt: string;
  requestedBy: string | null;
  comments: RoadmapComment[];
  attachments: RoadmapAttachment[];
  votes: RoadmapVote[];
  pinnedAt: string | null;
  pinnedUntil: string | null;
};

export type RoadmapVote = { voterKey: string; voterName: string | null };

export type RoadmapAttachment = {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
  previewUrl: string | null;
};

export type RoadmapComment = {
  id: string;
  body: string;
  author: string | null;
  createdAt: string;
};

/** Attribution travels as plain text because the canonical DB has no
 *  profiles row for users of the other environments. */
export type RoadmapActor = { id: string; name: string; email: string; isOwner?: boolean };

type Result = { ok: true } | { ok: false; error: string };

const SELECT =
  "id, title, body, kind, area, status, priority, decision_note, dev_update, dev_update_at, dev_update_needs_reply, pinned_at, pinned_until, created_at, updated_at, " +
  "requested_by_name, roadmap_comments(id, body, author_name, created_at), " +
  "roadmap_attachments(id, file_name, file_path, mime_type, size_bytes, uploaded_by_name, created_at), " +
  "roadmap_votes(voter_key, voter_name)";

/** Stamp preview_url onto image attachments in raw item rows — one bulk
 *  signed-URL mint, only where the storage keys live. A minting failure is
 *  reported, never fatal. */
export async function stampImagePreviews(rows: unknown[]): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  type RawAttach = { file_name: string; file_path?: string; preview_url?: string | null };
  const images: RawAttach[] = [];
  for (const r of rows as { roadmap_attachments?: RawAttach[] }[]) {
    for (const a of r.roadmap_attachments ?? []) {
      if (a.file_path && attachIsImage(a.file_name)) images.push(a);
    }
  }
  if (!images.length) return;
  const { data, error } = await admin.storage
    .from("attachments")
    .createSignedUrls(images.map((a) => a.file_path as string), 3600);
  if (error || !data) {
    await reportIssue({
      source: "server_action",
      route: "roadmap/stampImagePreviews",
      message: error?.message ?? "createSignedUrls returned nothing",
    });
    return;
  }
  images.forEach((a, i) => {
    a.preview_url = data[i]?.signedUrl ?? null;
  });
}

const PEER_DOWN =
  "Couldn't reach the production board — it holds the one true list. Nothing was saved; try again in a minute.";

const NO_PEER =
  "This environment has no link to the production board. Set SCHEMA_PEER_URL and SCHEMA_PEER_SECRET — there is no local copy to fall back to.";

/** True only on production, which physically holds the one board. */
export function isCanonicalBoard(): boolean {
  return process.env.VERCEL_ENV === "production";
}

async function fail(
  route: string,
  error: { message: string; code?: string },
  userId: string | null,
): Promise<{ ok: false; error: string }> {
  return reportAndFail(
    {
      source: "server_action",
      route,
      message: error.message,
      errorCode: error.code,
      userId: userId ?? undefined,
    },
    "Couldn't save that — try again.",
  );
}

function mapRow(raw: unknown): RoadmapItem {
  const r = raw as {
    id: string;
    title: string;
    body: string;
    kind: RoadmapKind;
    area: string;
    status: RoadmapStatus;
    priority: RoadmapPriority;
    decision_note: string | null;
    dev_update: string | null;
    dev_update_at: string | null;
    dev_update_needs_reply: boolean | null;
    pinned_at?: string | null;
    pinned_until?: string | null;
    created_at: string;
    updated_at: string | null;
    requested_by_name: string | null;
    roadmap_votes?: { voter_key: string; voter_name: string | null }[];
    roadmap_comments?: { id: string; body: string; author_name: string | null; created_at: string }[];
    roadmap_attachments?: {
      id: string;
      file_name: string;
      file_path?: string;
      mime_type: string | null;
      size_bytes: number;
      uploaded_by_name: string | null;
      created_at: string;
      preview_url?: string | null;
    }[];
  };
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    kind: r.kind,
    area: r.area,
    status: r.status,
    priority: r.priority,
    decisionNote: r.decision_note,
    devUpdate: r.dev_update,
    devUpdateAt: r.dev_update_at,
    devUpdateNeedsReply: r.dev_update_needs_reply ?? false,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? r.created_at,
    requestedBy: r.requested_by_name,
    comments: (r.roadmap_comments ?? [])
      .map((c) => ({ id: c.id, body: c.body, author: c.author_name, createdAt: c.created_at }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    attachments: (r.roadmap_attachments ?? [])
      .map((a) => ({
        id: a.id,
        fileName: a.file_name,
        mimeType: a.mime_type,
        sizeBytes: a.size_bytes,
        uploadedBy: a.uploaded_by_name,
        createdAt: a.created_at,
        previewUrl: a.preview_url ?? null,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    votes: (r.roadmap_votes ?? []).map((v) => ({ voterKey: v.voter_key, voterName: v.voter_name })),
    pinnedAt: r.pinned_at ?? null,
    pinnedUntil: r.pinned_until ?? null,
  };
}

/** The assembled board — items, comments, attachments and votes — is read on
 *  every admin view and is identical for every viewer. Hold it briefly so a
 *  reload doesn't re-read the whole board; any write clears it at once. */
const BOARD_TTL_MS = 30_000;
let boardCache: { items: RoadmapItem[]; shared: boolean; expires: number } | null = null;

function clearBoardCache(): void {
  boardCache = null;
}

export async function listRoadmapItems(): Promise<{ items: RoadmapItem[]; shared: boolean; error?: string }> {
  if (boardCache && boardCache.expires > Date.now()) {
    return { items: boardCache.items, shared: boardCache.shared };
  }
  const result = await loadRoadmapItems();
  if (!result.error) boardCache = { items: result.items, shared: result.shared, expires: Date.now() + BOARD_TTL_MS };
  return result;
}

async function loadRoadmapItems(): Promise<{ items: RoadmapItem[]; shared: boolean; error?: string }> {
  if (isCanonicalBoard()) {
    const admin = createAdminClient();
    if (!admin) return { items: [], shared: false, error: "Server is missing its Supabase keys." };
    const { data, error } = await admin
      .from("roadmap_items")
      .select(SELECT)
      .order("created_at", { ascending: true });
    if (error) return { items: [], shared: false, error: error.message };
    await stampImagePreviews(data ?? []);
    return { items: (data ?? []).map((r) => mapRow(r)), shared: false };
  }

  if (!peerConfigured()) return { items: [], shared: true, error: NO_PEER };

  try {
    const res = await peerFetch("/api/roadmap");
    if (!res.ok) throw new Error(`peer /api/roadmap returned ${res.status}`);
    const body = (await res.json()) as { items?: unknown[] };
    return { items: (body.items ?? []).map((r) => mapRow(r)), shared: true };
  } catch (e) {
    await reportIssue({
      source: "server_action",
      route: "lib/roadmap/list",
      message: e instanceof Error ? e.message : "peer unreachable",
    });
    return { items: [], shared: true, error: PEER_DOWN };
  }
}

async function peerMutate(
  payload: Record<string, unknown>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  if (!peerConfigured()) return { ok: false, error: NO_PEER };
  try {
    const res = await peerFetch("/api/roadmap", { method: "POST", body: JSON.stringify(payload) });
    const body = (await res.json().catch(() => null)) as
      | ({ ok?: boolean; error?: string } & Record<string, unknown>)
      | null;
    if (!res.ok || !body?.ok) {
      return { ok: false, error: body?.error ?? `The production board returned ${res.status}.` };
    }
    return { ok: true, data: body };
  } catch (e) {
    await reportIssue({
      source: "server_action",
      route: "lib/roadmap/mutate",
      message: e instanceof Error ? e.message : "peer unreachable",
    });
    return { ok: false, error: PEER_DOWN };
  }
}

export async function roadmapCreate(
  input: { title: string; body: string; kind: RoadmapKind; area: string; priority: RoadmapPriority },
  actor: RoadmapActor,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  clearBoardCache();
  if (!isCanonicalBoard()) {
    const res = await peerMutate({ action: "create", ...input, actor: { name: actor.name, email: actor.email } });
    if (!res.ok) return res;
    const id = res.data.id;
    if (typeof id !== "string") return { ok: false, error: "The production board didn't return the new item's id." };
    return { ok: true, id };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roadmap_items")
    .insert({
      title: input.title,
      body: input.body,
      kind: input.kind,
      area: input.area,
      priority: input.priority,
      requested_by: actor.id,
      requested_by_name: actor.name,
    })
    .select("id")
    .single();
  if (error) return fail("roadmap/create", error, actor.id);
  return { ok: true, id: data.id };
}

export async function roadmapUpdate(
  itemId: string,
  input: {
    status: RoadmapStatus;
    priority: RoadmapPriority;
    kind: RoadmapKind;
    area: string;
    decisionNote: string | null;
    devUpdate: string | null;
    devUpdateNeedsReply: boolean;
  },
  actor: RoadmapActor,
): Promise<Result> {
  clearBoardCache();
  if (!isCanonicalBoard()) {
    return peerMutate({
      action: "update",
      id: itemId,
      ...input,
      actor: { name: actor.name, email: actor.email },
    });
  }
  const supabase = await createClient();
  const { data: before, error: readErr } = await supabase
    .from("roadmap_items")
    .select("dev_update, dev_update_at")
    .eq("id", itemId)
    .single();
  if (readErr) return fail("roadmap/update", readErr, actor.id);
  const devChanged = (before.dev_update ?? null) !== input.devUpdate;

  const { error } = await supabase
    .from("roadmap_items")
    .update({
      status: input.status,
      priority: input.priority,
      kind: input.kind,
      area: input.area,
      decision_note: input.decisionNote,
      dev_update: input.devUpdate,
      dev_update_needs_reply: input.devUpdate ? input.devUpdateNeedsReply : false,
      dev_update_at: devChanged
        ? input.devUpdate
          ? new Date().toISOString()
          : null
        : before.dev_update_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .select("id")
    .single();
  if (error) return fail("roadmap/update", error, actor.id);
  return { ok: true };
}

export type EditChange = { field: "title" | "body"; from: string; to: string };

const clipChange = (s: string) => (s.length > 400 ? `${s.slice(0, 400)}…` : s);

export async function roadmapEditText(
  itemId: string,
  input: { title: string; body: string },
  actor: RoadmapActor,
): Promise<{ ok: true; changed: EditChange[] } | { ok: false; error: string }> {
  clearBoardCache();
  if (!isCanonicalBoard()) {
    const res = await peerMutate({
      action: "edit_text",
      id: itemId,
      title: input.title,
      body: input.body,
      actor: { name: actor.name, email: actor.email },
    });
    if (!res.ok) return res;
    return { ok: true, changed: Array.isArray(res.data.changed) ? (res.data.changed as EditChange[]) : [] };
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Editing needs the service-role key configured." };
  const { data: before, error: readErr } = await admin
    .from("roadmap_items")
    .select("title, body")
    .eq("id", itemId)
    .single();
  if (readErr) return fail("roadmap/editText", readErr, actor.id);

  const changed: EditChange[] = [];
  if (before.title !== input.title) changed.push({ field: "title", from: clipChange(before.title), to: clipChange(input.title) });
  if ((before.body ?? "") !== input.body) changed.push({ field: "body", from: clipChange(before.body ?? ""), to: clipChange(input.body) });
  if (changed.length === 0) return { ok: true, changed };

  const { error } = await admin
    .from("roadmap_items")
    .update({ title: input.title, body: input.body, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .select("id")
    .single();
  if (error) return fail("roadmap/editText", error, actor.id);
  return { ok: true, changed };
}

export async function roadmapDelete(itemId: string, actor: RoadmapActor): Promise<Result> {
  clearBoardCache();
  if (!isCanonicalBoard()) {
    return peerMutate({ action: "delete", id: itemId, actor: { name: actor.name, email: actor.email } });
  }
  const supabase = await createClient();
  const { error } = await supabase.from("roadmap_items").delete().eq("id", itemId).select("id").single();
  if (error) return fail("roadmap/delete", error, actor.id);
  return { ok: true };
}

export async function roadmapComment(itemId: string, body: string, actor: RoadmapActor): Promise<Result> {
  clearBoardCache();
  if (!isCanonicalBoard()) {
    return peerMutate({ action: "comment", id: itemId, body, actor: { name: actor.name, email: actor.email } });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("roadmap_comments")
    .insert({ item_id: itemId, body, author_id: actor.id, author_name: actor.name })
    .select("id")
    .single();
  if (error) return fail("roadmap/comment", error, actor.id);
  return { ok: true };
}

/** Remove a note outright — owner-only, gated by the action layer. The
 *  thread still can't be rewritten (no update path, on purpose); delete
 *  exists for the note that never belonged there, like a pasted password. */
export async function roadmapCommentDelete(commentId: string, actor: RoadmapActor): Promise<Result> {
  clearBoardCache();
  if (!isCanonicalBoard()) {
    return peerMutate({ action: "comment_delete", commentId, actor: { name: actor.name, email: actor.email } });
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Server is missing its Supabase keys." };
  const { error } = await admin.from("roadmap_comments").delete().eq("id", commentId).select("id").single();
  if (error) return fail("roadmap/commentDelete", error, actor.id);
  return { ok: true };
}

export async function roadmapVote(
  itemId: string,
  actor: RoadmapActor,
): Promise<{ ok: true; voted: boolean } | { ok: false; error: string }> {
  clearBoardCache();
  if (!isCanonicalBoard()) {
    const res = await peerMutate({
      action: "vote",
      id: itemId,
      actor: { id: actor.id, name: actor.name, email: actor.email },
    });
    if (!res.ok) return res;
    return { ok: true, voted: res.data.voted === true };
  }
  const supabase = await createClient();
  const { data: existing, error: readErr } = await supabase
    .from("roadmap_votes")
    .select("id")
    .eq("item_id", itemId)
    .eq("voter_key", actor.id)
    .maybeSingle();
  if (readErr) return fail("roadmap/vote", readErr, actor.id);
  if (existing) {
    const { error } = await supabase.from("roadmap_votes").delete().eq("id", existing.id);
    if (error) return fail("roadmap/vote", error, actor.id);
    return { ok: true, voted: false };
  }
  const { error: insertErr } = await supabase
    .from("roadmap_votes")
    .insert({ item_id: itemId, voter_key: actor.id, voter_name: actor.name });
  if (insertErr) {
    if (insertErr.code === "23505") {
      const { error } = await supabase.from("roadmap_votes").delete().eq("item_id", itemId).eq("voter_key", actor.id);
      if (error) return fail("roadmap/vote", error, actor.id);
      return { ok: true, voted: false };
    }
    return fail("roadmap/vote", insertErr, actor.id);
  }
  return { ok: true, voted: true };
}

export type RoadmapPinInput = { pinned: boolean; days: number | null };

export async function roadmapSetPin(itemId: string, input: RoadmapPinInput, actor: RoadmapActor): Promise<Result> {
  clearBoardCache();
  if (!isCanonicalBoard()) {
    return peerMutate({
      action: "set_pin",
      id: itemId,
      pinned: input.pinned,
      days: input.days,
      actor: { name: actor.name, email: actor.email },
    });
  }
  const supabase = await createClient();
  const now = Date.now();
  const { error } = await supabase
    .from("roadmap_items")
    .update(
      input.pinned
        ? {
            pinned_at: new Date(now).toISOString(),
            pinned_until: input.days ? new Date(now + input.days * 86_400_000).toISOString() : null,
          }
        : { pinned_at: null, pinned_until: null },
    )
    .eq("id", itemId)
    .select("id")
    .single();
  if (error) return fail("roadmap/setPin", error, actor.id);
  return { ok: true };
}

export async function roadmapAttachTicket(
  itemId: string,
  file: { name: string; sizeBytes: number },
  actor: RoadmapActor,
): Promise<{ ok: true; path: string; signedUrl: string } | { ok: false; error: string }> {
  const problem = attachProblem(file.name, file.sizeBytes);
  if (problem) return { ok: false, error: problem };

  if (!isCanonicalBoard()) {
    const res = await peerMutate({
      action: "attach_ticket",
      id: itemId,
      fileName: file.name,
      sizeBytes: file.sizeBytes,
      actor: { name: actor.name, email: actor.email },
    });
    if (!res.ok) return res;
    const { path, signedUrl } = res.data;
    if (typeof path !== "string" || typeof signedUrl !== "string") {
      return { ok: false, error: "The production board didn't return an upload ticket." };
    }
    return { ok: true, path, signedUrl };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Storage isn't configured here — missing the service key." };
  const { count, error: countError } = await admin
    .from("roadmap_attachments")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId);
  if (countError) return fail("roadmap/attachTicket", countError, actor.id);
  if ((count ?? 0) >= ATTACH_MAX_FILES) return { ok: false, error: `That item already holds ${ATTACH_MAX_FILES} files.` };
  const path = `roadmap/${itemId}/${randomUUID()}/${attachSafeName(file.name)}`;
  const { data, error } = await admin.storage.from("attachments").createSignedUploadUrl(path);
  if (error) return fail("roadmap/attachTicket", error, actor.id);
  return { ok: true, path: data.path, signedUrl: data.signedUrl };
}

export async function roadmapAttachRegister(
  itemId: string,
  file: { name: string; path: string; mimeType: string | null; sizeBytes: number },
  actor: RoadmapActor,
): Promise<Result> {
  if (!file.path.startsWith(`roadmap/${itemId}/`)) return { ok: false, error: "Bad storage path." };
  clearBoardCache();
  if (!isCanonicalBoard()) {
    return peerMutate({
      action: "attach_register",
      id: itemId,
      fileName: file.name,
      path: file.path,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      actor: { name: actor.name, email: actor.email },
    });
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Server is missing its Supabase keys." };
  const { error } = await admin
    .from("roadmap_attachments")
    .insert({
      item_id: itemId,
      file_name: file.name,
      file_path: file.path,
      mime_type: file.mimeType,
      size_bytes: file.sizeBytes,
      uploaded_by: actor.id,
      uploaded_by_name: actor.name,
    })
    .select("id")
    .single();
  if (error) return fail("roadmap/attachRegister", error, actor.id);
  return { ok: true };
}

export async function roadmapAttachmentUrl(
  attachmentId: string,
  actor: RoadmapActor,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isCanonicalBoard()) {
    const res = await peerMutate({ action: "attach_download", attachmentId, actor: { name: actor.name, email: actor.email } });
    if (!res.ok) return res;
    const url = res.data.url;
    if (typeof url !== "string") return { ok: false, error: "The production board didn't return a download link." };
    return { ok: true, url };
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Storage isn't configured here — missing the service key." };
  const { data, error } = await admin
    .from("roadmap_attachments")
    .select("file_path, file_name")
    .eq("id", attachmentId)
    .single();
  if (error) return fail("roadmap/attachmentUrl", error, actor.id);
  const { data: signed, error: signError } = await admin.storage
    .from("attachments")
    .createSignedUrl(data.file_path, 300, { download: data.file_name });
  if (signError) return fail("roadmap/attachmentUrl", signError, actor.id);
  return { ok: true, url: signed.signedUrl };
}

export async function roadmapAttachmentDelete(attachmentId: string, actor: RoadmapActor): Promise<Result> {
  clearBoardCache();
  if (!isCanonicalBoard()) {
    return peerMutate({ action: "attach_delete", attachmentId, actor: { name: actor.name, email: actor.email } });
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Server is missing its Supabase keys." };
  const { data, error } = await admin
    .from("roadmap_attachments")
    .delete()
    .eq("id", attachmentId)
    .select("file_path")
    .single();
  if (error) return fail("roadmap/attachmentDelete", error, actor.id);

  await admin.storage.from("attachments").remove([data.file_path]);
  return { ok: true };
}
