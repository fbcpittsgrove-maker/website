import { requireOwner } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { IssuesList } from "./issues-list";

export default async function AdminIssuesPage() {
  await requireOwner();
  const admin = createAdminClient();
  if (!admin) throw new Error("Issues: admin client is not configured");

  if (admin) {
    await admin.rpc("prune_app_issues");
  }

  const { data: issues, error: issuesError } = admin
    ? await admin
        .from("app_issues")
        .select(
          "id, environment, source, route, message, error_code, times_seen, last_seen_at, resolved_at",
        )
        .order("last_seen_at", { ascending: false })
        .limit(100)
    : { error: null, data: null };
  if (issuesError) throw new Error("Admin Issues: app_issues read failed — " + issuesError.message);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Issues</h1>
      <p className="mt-1 text-sm text-muted">
        Live failures from every environment — seen here before the client feels them.
      </p>
      <IssuesList initial={issues ?? []} />
    </div>
  );
}
