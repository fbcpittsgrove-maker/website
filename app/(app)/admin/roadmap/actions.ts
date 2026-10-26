"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reportAndFail } from "@/lib/issues";
import { logActivity } from "@/lib/activity";
import { getProfile, NotAuthorizedError, type Profile } from "@/lib/auth/profile";
import {
  isCanonicalBoard,
  roadmapAttachmentDelete,
  roadmapAttachmentUrl,
  roadmapAttachRegister,
  roadmapAttachTicket,
  roadmapComment,
  roadmapCommentDelete,
  roadmapCreate,
  roadmapDelete,
  roadmapEditText,
  roadmapSetPin,
  roadmapUpdate,
  roadmapVote,
  type RoadmapActor,
  type RoadmapPinInput,
} from "@/lib/roadmap";
import {
  KINDS,
  PRIORITIES,
  STATUSES,
  type RoadmapKind,
  type RoadmapPriority,
  type RoadmapStatus,
} from "./constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

function guard(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof NotAuthorizedError ? e.message : "Not authorized." };
}

async function requireAdminOrOwner(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !profile.active || (profile.role !== "admin" && !profile.is_owner)) {
    throw new NotAuthorizedError("You don't have access to do that.");
  }
  return profile;
}

async function requireOwner(): Promise<Profile> {
  const profile = await requireAdminOrOwner();
  if (!profile.is_owner) throw new NotAuthorizedError("Only owners can manage the roadmap.");
  return profile;
}

const actorOf = (p: Profile): RoadmapActor => ({ id: p.id, name: p.full_name, email: p.email, isOwner: p.is_owner });

async function logLocal(profileId: string, action: string, meta: Record<string, unknown>) {
  if (isCanonicalBoard()) await logActivity(profileId, action, meta);
}

export async function createRoadmapItem(input: {
  title: string;
  body: string;
  kind: string;
  area: string;
  priority: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let profile: Profile;
  try {
    profile = await requireAdminOrOwner();
  } catch (e) {
    return guard(e);
  }
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give it a title." };
  if (!(KINDS as readonly string[]).includes(input.kind)) return { ok: false, error: "Pick a type." };
  if (!(PRIORITIES as readonly string[]).includes(input.priority)) return { ok: false, error: "Pick a priority." };

  const res = await roadmapCreate(
    {
      title,
      body: input.body.trim(),
      kind: input.kind as RoadmapKind,
      area: input.area.trim() || "general",
      priority: input.priority as RoadmapPriority,
    },
    actorOf(profile),
  );
  if (!res.ok) return res;
  await logLocal(profile.id, "roadmap_item_requested", { title });
  revalidatePath("/admin/roadmap");
  return { ok: true, id: res.id };
}

export async function updateRoadmapItem(
  itemId: string,
  input: { status: string; priority: string; kind: string; area: string; decisionNote: string; devUpdate: string; devUpdateNeedsReply: boolean },
): Promise<ActionResult> {
  let profile: Profile;
  try {
    profile = await requireOwner();
  } catch (e) {
    return guard(e);
  }
  if (!(STATUSES as readonly string[]).includes(input.status)) return { ok: false, error: "Pick a status." };
  if (!(PRIORITIES as readonly string[]).includes(input.priority)) return { ok: false, error: "Pick a priority." };
  if (!(KINDS as readonly string[]).includes(input.kind)) return { ok: false, error: "Pick a type." };

  const res = await roadmapUpdate(
    itemId,
    {
      status: input.status as RoadmapStatus,
      priority: input.priority as RoadmapPriority,
      kind: input.kind as RoadmapKind,
      area: input.area.trim() || "general",
      decisionNote: input.decisionNote.trim() || null,
      devUpdate: input.devUpdate.trim() || null,
      devUpdateNeedsReply: input.devUpdateNeedsReply,
    },
    actorOf(profile),
  );
  if (!res.ok) return res;
  await logLocal(profile.id, "roadmap_item_updated", { id: itemId, status: input.status });
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function voteOnRoadmapItem(itemId: string): Promise<ActionResult> {
  let me;
  try {
    me = await requireAdminOrOwner();
  } catch (e) {
    return guard(e);
  }
  const res = await roadmapVote(itemId, actorOf(me));
  if (!res.ok) return res;
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function setRoadmapPin(itemId: string, input: RoadmapPinInput): Promise<ActionResult> {
  let profile: Profile;
  try {
    profile = await requireOwner();
  } catch (e) {
    return guard(e);
  }
  const res = await roadmapSetPin(itemId, input, actorOf(profile));
  if (!res.ok) return res;
  await logLocal(profile.id, "roadmap_item_pinned", { id: itemId, pinned: input.pinned, days: input.days });
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function saveSectionOrder(order: string[]): Promise<ActionResult> {
  let me;
  try {
    me = await requireAdminOrOwner();
  } catch (e) {
    return guard(e);
  }
  const clean = [...new Set(order)].filter((s) => (STATUSES as readonly string[]).includes(s));
  if (clean.length === 0) return { ok: false, error: "That's not a section order." };

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase.from("profiles").select("ui_prefs").eq("id", me.id).single();
  if (readErr)
    return reportAndFail({ source: "server_action", route: "roadmap/saveSectionOrder", message: readErr.message, errorCode: readErr.code, userId: me.id }, "Couldn't save the layout.");
  const prefs = { ...((row.ui_prefs as Record<string, unknown> | null) ?? {}), roadmap_section_order: clean };
  const { error } = await supabase.from("profiles").update({ ui_prefs: prefs }).eq("id", me.id);
  if (error)
    return reportAndFail({ source: "server_action", route: "roadmap/saveSectionOrder", message: error.message, errorCode: error.code, userId: me.id }, "Couldn't save the layout.");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function saveSectionCollapsed(collapsed: string[]): Promise<ActionResult> {
  let me;
  try {
    me = await requireAdminOrOwner();
  } catch (e) {
    return guard(e);
  }
  const clean = [...new Set(collapsed)].filter((s) => (STATUSES as readonly string[]).includes(s));

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase.from("profiles").select("ui_prefs").eq("id", me.id).single();
  if (readErr)
    return reportAndFail({ source: "server_action", route: "roadmap/saveSectionCollapsed", message: readErr.message, errorCode: readErr.code, userId: me.id }, "Couldn't save.");
  const prefs = { ...((row.ui_prefs as Record<string, unknown> | null) ?? {}), roadmap_collapsed: clean };
  const { error } = await supabase.from("profiles").update({ ui_prefs: prefs }).eq("id", me.id);
  if (error)
    return reportAndFail({ source: "server_action", route: "roadmap/saveSectionCollapsed", message: error.message, errorCode: error.code, userId: me.id }, "Couldn't save.");
  return { ok: true };
}

export async function editRoadmapItemText(
  itemId: string,
  input: { title: string; body: string },
): Promise<ActionResult> {
  let me;
  try {
    me = await requireOwner();
  } catch (e) {
    return guard(e);
  }
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give it a title." };
  if (title.length > 200) return { ok: false, error: "Keep the title under 200 characters." };
  const text = input.body.trim();
  if (text.length > 10000) return { ok: false, error: "That description is too long — keep it under 10,000 characters." };

  const res = await roadmapEditText(itemId, { title, body: text }, actorOf(me));
  if (!res.ok) return res;
  if (res.changed.length > 0) await logLocal(me.id, "roadmap_item_edited", { item_id: itemId, title, changed: res.changed });
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function deleteRoadmapItem(itemId: string): Promise<ActionResult> {
  let profile: Profile;
  try {
    profile = await requireOwner();
  } catch (e) {
    return guard(e);
  }
  const res = await roadmapDelete(itemId, actorOf(profile));
  if (!res.ok) return res;
  await logLocal(profile.id, "roadmap_item_deleted", { id: itemId });
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function commentOnRoadmapItem(itemId: string, body: string): Promise<ActionResult> {
  let me;
  try {
    me = await requireAdminOrOwner();
  } catch (e) {
    return guard(e);
  }
  const text = body.trim();
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > 2000) return { ok: false, error: "That's a bit long — keep it under 2000 characters." };

  const res = await roadmapComment(itemId, text, actorOf(me));
  if (!res.ok) return res;
  await logLocal(me.id, "roadmap_item_commented", { item_id: itemId });
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function deleteRoadmapComment(commentId: string): Promise<ActionResult> {
  let me;
  try {
    me = await requireOwner();
  } catch (e) {
    return guard(e);
  }
  const res = await roadmapCommentDelete(commentId, actorOf(me));
  if (!res.ok) return res;
  await logLocal(me.id, "roadmap_comment_deleted", { comment_id: commentId });
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function requestAttachmentTicket(
  itemId: string,
  file: { name: string; sizeBytes: number },
): Promise<{ ok: true; path: string; signedUrl: string } | { ok: false; error: string }> {
  let me;
  try {
    me = await requireAdminOrOwner();
  } catch (e) {
    return guard(e);
  }
  return roadmapAttachTicket(itemId, file, actorOf(me));
}

export async function registerAttachment(
  itemId: string,
  file: { name: string; path: string; mimeType: string | null; sizeBytes: number },
): Promise<ActionResult> {
  let me;
  try {
    me = await requireAdminOrOwner();
  } catch (e) {
    return guard(e);
  }
  const res = await roadmapAttachRegister(itemId, file, actorOf(me));
  if (!res.ok) return res;
  await logLocal(me.id, "roadmap_item_attached", { item_id: itemId, file_name: file.name });
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function attachmentDownloadUrl(
  attachmentId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  let me;
  try {
    me = await requireAdminOrOwner();
  } catch (e) {
    return guard(e);
  }
  return roadmapAttachmentUrl(attachmentId, actorOf(me));
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  let me;
  try {
    me = await requireOwner();
  } catch (e) {
    return guard(e);
  }
  const res = await roadmapAttachmentDelete(attachmentId, actorOf(me));
  if (!res.ok) return res;
  await logLocal(me.id, "roadmap_attachment_deleted", { attachment_id: attachmentId });
  revalidatePath("/admin/roadmap");
  return { ok: true };
}
