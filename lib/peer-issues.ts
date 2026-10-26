import { createAdminClient } from "@/lib/supabase/admin";
import { environmentName, releaseSha } from "@/lib/issues";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA = /^[0-9a-f]{40}$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const SELECT = "id, source, route, message, error_code, detail, release_sha, times_seen, first_seen_at, last_seen_at";
const PRIVATE_KEY = /password|passwd|secret|token|authorization|cookie|credential|api.?key|private.?key|body|payload|headers|input|form.?data|user.?id|email/i;

class PeerIssueError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && TIME.test(value) && Number.isFinite(Date.parse(value));
}

function text(value: string, limit: number): string {
  return value.slice(0, 16000)
    .replace(/https?:\/\/[^\s<>"']+/gi, "[url]")
    .replace(/\?[^\s<>"']*/g, "[query]")
    .replace(/\bBearer\s+[^\s,"']+/gi, "Bearer [redacted]")
    .replace(/\b(?:password|passwd|secret|token|authorization|api[_-]?key|cookie)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "[credential redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?/g, "[token]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[identifier redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .slice(0, limit);
}

export function sanitizeIssueDetail(value: unknown): unknown {
  let remaining = 8000;
  function visit(item: unknown, depth: number): unknown {
    if (remaining <= 0 || depth > 4) return "[truncated]";
    if (item === null || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) { remaining -= 16; return item; }
    if (typeof item === "string") {
      const result = text(item, Math.min(1000, remaining));
      remaining -= result.length + 4;
      return result;
    }
    if (Array.isArray(item)) return item.slice(0, 20).map((entry) => visit(entry, depth + 1));
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).slice(0, 40).map(([key, entry]) => {
        remaining -= Math.min(key.length, 80) + 4;
        return [text(key, 80), PRIVATE_KEY.test(key) ? "[redacted]" : visit(entry, depth + 1)];
      }));
    }
    return "[unsupported]";
  }
  return visit(value, 0);
}

function identity() {
  return { environment: environmentName(), releaseSha: releaseSha() };
}

function admin() {
  const client = createAdminClient();
  if (!client) throw new PeerIssueError(503, "peer_issues_unavailable");
  return client;
}

function responseError(error: unknown): Response {
  return Response.json({ error: error instanceof PeerIssueError ? error.message : "peer_issues_unavailable" },
    { status: error instanceof PeerIssueError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
}

export async function listPeerIssues(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some((key) => !["action", "limit", "after"].includes(key) || params.getAll(key).length !== 1)
      || params.get("action") !== "issues") throw new PeerIssueError(400, "invalid_issue_page");
    const limitText = params.get("limit") ?? "50";
    const after = params.get("after");
    if (!/^[1-9]\d{0,2}$/.test(limitText) || Number(limitText) > 100 || (after !== null && !UUID.test(after))) throw new PeerIssueError(400, "invalid_issue_page");
    const limit = Number(limitText);
    const db = admin();
    let query = db.from("app_issues").select(SELECT).is("resolved_at", null).order("id", { ascending: true }).limit(limit + 1);
    if (after) query = query.gt("id", after);
    const [rows, total] = await Promise.all([query, db.from("app_issues").select("id", { count: "exact", head: true }).is("resolved_at", null)]);
    if (rows.error || total.error || !Array.isArray(rows.data) || rows.data.length > limit + 1 || !Number.isSafeInteger(total.count) || total.count === null || total.count < 0) throw new PeerIssueError(503, "peer_issues_unavailable");
    let previous = after ?? "";
    const issues = rows.data.map((row) => {
      if (typeof row.id !== "string" || !UUID.test(row.id) || row.id <= previous || !Number.isSafeInteger(row.times_seen) || row.times_seen < 1
        || !timestamp(row.first_seen_at) || !timestamp(row.last_seen_at) || typeof row.message !== "string"
        || !["server_action", "route", "client", "proxy"].includes(row.source)
        || !(row.route === null || typeof row.route === "string") || !(row.error_code === null || typeof row.error_code === "string")
        || !(row.release_sha === null || (typeof row.release_sha === "string" && SHA.test(row.release_sha)))) throw new PeerIssueError(503, "peer_issues_invalid");
      previous = row.id;
      return { id: row.id, source: row.source, route: row.route === null ? null : text(row.route, 500), message: text(row.message, 2000),
        errorCode: row.error_code === null ? null : text(row.error_code, 100), detail: sanitizeIssueDetail(row.detail), releaseSha: row.release_sha,
        timesSeen: row.times_seen, firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at };
    });
    const hasMore = issues.length > limit;
    const page = issues.slice(0, limit);
    return Response.json({ version: 1, ...identity(), capturedAt: new Date().toISOString(), totalOpen: total.count,
      issues: page, nextAfter: hasMore ? page.at(-1)!.id : null, complete: !hasMore }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseError(error); }
}

export async function resolvePeerIssue(request: Request): Promise<Response> {
  try {
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new PeerIssueError(415, "json_required");
    const reader = request.body?.getReader();
    if (!reader) throw new PeerIssueError(400, "invalid_issue_resolution");
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const result = await reader.read();
        if (result.done) break;
        bytes += result.value.byteLength;
        if (bytes > 4096) { await reader.cancel(); throw new PeerIssueError(413, "issue_resolution_too_large"); }
        chunks.push(result.value);
      }
    } finally { reader.releaseLock(); }
    let value: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      value = parsed as Record<string, unknown>;
    } catch { throw new PeerIssueError(400, "invalid_issue_resolution"); }
    const keys = ["action", "id", "timesSeen", "lastSeenAt", "expectedEnvironment", "expectedReleaseSha"];
    if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key)) || value.action !== "resolve_issue"
      || typeof value.id !== "string" || !UUID.test(value.id) || typeof value.timesSeen !== "number" || !Number.isSafeInteger(value.timesSeen) || value.timesSeen < 1
      || !timestamp(value.lastSeenAt) || !["master", "develop"].includes(String(value.expectedEnvironment))
      || typeof value.expectedReleaseSha !== "string" || !SHA.test(value.expectedReleaseSha)) throw new PeerIssueError(400, "invalid_issue_resolution");
    const deployed = identity();
    if (value.expectedEnvironment !== deployed.environment || value.expectedReleaseSha !== deployed.releaseSha) throw new PeerIssueError(409, "issue_deployment_changed");
    const resolvedAt = new Date().toISOString();
    const result = await admin().from("app_issues").update({ resolved_at: resolvedAt }).eq("id", value.id)
      .is("resolved_at", null).eq("times_seen", value.timesSeen).eq("last_seen_at", value.lastSeenAt).select("id").maybeSingle();
    if (result.error) throw new PeerIssueError(503, "peer_issues_unavailable");
    if (!result.data) throw new PeerIssueError(409, "issue_changed_or_already_resolved");
    if (result.data.id !== value.id) throw new PeerIssueError(503, "peer_issues_invalid");
    return Response.json({ version: 1, ...deployed, id: value.id, resolvedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseError(error); }
}
