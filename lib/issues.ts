import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Owner observability: every server-action Supabase-error path reports here,
 * so failures land in /admin/issues instead of a console nobody reads.
 * Dedupes by fingerprint — one row per distinct problem, repeats bump
 * times_seen.
 */

export type IssueSource = "server_action" | "route" | "client" | "proxy";

export type IssueReport = {
  source: IssueSource;
  route?: string;
  message: string;
  errorCode?: string;
  detail?: unknown;
  userId?: string;
};

export function environmentName(): string {
  if (process.env.VERCEL_ENV === "production") return "master";
  if (process.env.VERCEL_ENV) return "develop";
  return "local";
}

export function releaseSha(): string | null {
  return process.env.VERCEL_GIT_COMMIT_SHA ?? null;
}

function environment(): string {
  return environmentName();
}

function fingerprintOf(report: IssueReport): string {
  const normalized = report.message
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<uuid>")
    .replace(/\d+/g, "<n>")
    .slice(0, 200);
  return [environment(), report.source, report.route ?? "", report.errorCode ?? "", normalized]
    .join("|")
    .slice(0, 500);
}

export async function reportIssue(report: IssueReport): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    await admin.rpc("report_issue", {
      p_fingerprint: fingerprintOf(report),
      p_environment: environment(),
      p_source: report.source,
      p_route: report.route ?? null,
      p_message: report.message.slice(0, 2000),
      p_error_code: report.errorCode ?? null,
      p_detail: report.detail ? JSON.parse(JSON.stringify(report.detail)) : null,
      p_release_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      p_user_id: report.userId ?? null,
    });
  } catch {
    // The issue log must never become the issue.
  }
}

/** Expected errors RETURN, never throw — production masks thrown server-action
 *  errors as "Minified React error #441", so callers render result.error. */
export async function reportAndFail(
  report: IssueReport,
  userMessage: string,
): Promise<{ ok: false; error: string }> {
  await reportIssue(report);
  return { ok: false, error: userMessage };
}
