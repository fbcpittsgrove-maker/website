import { createAdminClient } from "@/lib/supabase/admin";
import { reportIssue } from "@/lib/issues";

/** Append-only admin activity feed. Service-role write only; never throws —
 *  the action it describes already happened. */
export async function logActivity(
  actorId: string | null,
  action: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const { error } = await admin.from("activity_log").insert({
      actor_id: actorId,
      action,
      detail: detail ?? {},
    });
    if (error) {
      void reportIssue({
        source: "server_action",
        route: "activity.logActivity",
        message: error.message,
        errorCode: error.code,
      });
    }
  } catch {
    // Logging never breaks the action it describes.
  }
}
