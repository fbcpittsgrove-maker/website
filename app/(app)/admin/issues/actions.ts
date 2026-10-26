"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportAndFail } from "@/lib/issues";

export async function resolveIssue(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireOwner();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Server is missing its Supabase keys." };

  const { error } = await admin.from("app_issues").update({ resolved_at: new Date().toISOString() }).eq("id", id);
  if (error) return reportAndFail({ source: "server_action", route: "issues.resolve", message: error.message, errorCode: error.code, userId: actor.id }, "Couldn't resolve that issue.");

  revalidatePath("/admin/issues");
  return { ok: true };
}
