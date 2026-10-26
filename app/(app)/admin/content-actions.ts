"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { reportAndFail } from "@/lib/issues";
import { CONTENT_LABEL, parseContent, type ContentKind } from "@/lib/content";

type Result = { ok: true } | { ok: false; error: string };

const KINDS: ContentKind[] = ["events", "sermons", "announcements"];

function refresh(kind: ContentKind) {
  revalidatePath(`/admin/${kind}`);
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Create (id null) or update one content row. RLS lets any active member
 *  write; the session client is used so that gate stays the enforcement. */
export async function saveContent(kind: ContentKind, id: string | null, form: Record<string, unknown>): Promise<Result> {
  const actor = await requireStaff();
  if (!KINDS.includes(kind)) return { ok: false, error: "Unknown content type." };
  const parsed = parseContent(kind, form);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from(kind).update(parsed.value).eq("id", id).select("id").single()
    : await supabase.from(kind).insert({ ...parsed.value, created_by: actor.id }).select("id").single();
  if (error) {
    return reportAndFail(
      { source: "server_action", route: `content.save.${kind}`, message: error.message, errorCode: error.code, userId: actor.id },
      `Couldn't save that ${CONTENT_LABEL[kind].singular}.`,
    );
  }
  await logActivity(actor.id, id ? `${kind}_updated` : `${kind}_created`, { id, title: parsed.value.title });
  refresh(kind);
  return { ok: true };
}

export async function deleteContent(kind: ContentKind, id: string): Promise<Result> {
  const actor = await requireStaff();
  if (!KINDS.includes(kind)) return { ok: false, error: "Unknown content type." };
  const supabase = await createClient();
  const { error } = await supabase.from(kind).delete().eq("id", id).select("id").single();
  if (error) {
    return reportAndFail(
      { source: "server_action", route: `content.delete.${kind}`, message: error.message, errorCode: error.code, userId: actor.id },
      `Couldn't delete that ${CONTENT_LABEL[kind].singular}.`,
    );
  }
  await logActivity(actor.id, `${kind}_deleted`, { id });
  refresh(kind);
  return { ok: true };
}
