import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/schema-fingerprint/route";
import { sanitizeIssueDetail } from "./peer-issues";

const { createAdminClient, captureFingerprint, environmentName, releaseSha, from, update, eq, is, order, limit, gt, maybeSingle, rows, total } = vi.hoisted(() => ({
  createAdminClient: vi.fn(), captureFingerprint: vi.fn(), environmentName: vi.fn(), releaseSha: vi.fn(), from: vi.fn(),
  update: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), limit: vi.fn(), gt: vi.fn(), maybeSingle: vi.fn(), rows: vi.fn(), total: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/schema-fingerprint", () => ({ captureFingerprint }));
vi.mock("@/lib/issues", () => ({ environmentName, releaseSha }));
vi.mock("@/lib/peer-issues", () => import("./peer-issues"));

const SECRET = "synthetic-peer-secret";
const SHA = "a".repeat(40);
const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ID3 = "33333333-3333-4333-8333-333333333333";
const STAMP = "2026-10-19T12:00:00.123456+00:00";
const issue = { id: ID, source: "server_action", route: "content.save.events", message: "RLS rejected insert", error_code: "42501",
  detail: { stack: "Error\n at recordPageView", password: "private" }, release_sha: SHA, times_seen: 20, first_seen_at: STAMP, last_seen_at: STAMP };
const payload = { action: "resolve_issue", id: ID, timesSeen: 20, lastSeenAt: STAMP, expectedEnvironment: "develop", expectedReleaseSha: SHA };

function get(query = "?action=issues", authorization = `Bearer ${SECRET}`) {
  return GET(new NextRequest(`https://fbc-pittsgrove.example/api/schema-fingerprint${query}`, { headers: { authorization } }));
}

function post(value: unknown = payload, authorization = `Bearer ${SECRET}`, contentType = "application/json") {
  return POST(new NextRequest("https://fbc-pittsgrove.example/api/schema-fingerprint", { method: "POST", headers: { authorization, "content-type": contentType }, body: JSON.stringify(value) }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SCHEMA_PEER_SECRET", SECRET);
  environmentName.mockReturnValue("develop");
  releaseSha.mockReturnValue(SHA);
  captureFingerprint.mockResolvedValue({ environment: "develop", release_sha: SHA });
  rows.mockResolvedValue({ data: [issue], error: null });
  total.mockResolvedValue({ count: 1, error: null });
  maybeSingle.mockResolvedValue({ data: { id: ID }, error: null });
  from.mockImplementation(() => {
    let count = false;
    const query = { select: vi.fn((_fields: string, options?: { head?: boolean }) => { count = options?.head === true; return query; }),
      is, eq, order, limit, gt, update, maybeSingle,
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => (count ? total() : rows()).then(resolve, reject) };
    for (const method of [is, eq, order, limit, gt, update]) method.mockReturnValue(query);
    return query;
  });
  createAdminClient.mockReturnValue({ from });
});

afterEach(() => { vi.unstubAllEnvs(); });

describe("authenticated peer issue access", () => {
  it.each(["", "Bearer wrong", `Bearer ${SECRET}x`])("rejects invalid authentication before any database access", async (authorization) => {
    expect((await get("?action=issues", authorization)).status).toBe(401);
    expect((await post(payload, authorization)).status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(captureFingerprint).not.toHaveBeenCalled();
  });

  it("fails closed without a configured secret", async () => {
    vi.stubEnv("SCHEMA_PEER_SECRET", "");
    expect((await get()).status).toBe(401);
    expect((await post()).status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("preserves fingerprint reads and marks responses no-store", async () => {
    const result = await get("");
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ environment: "develop", release_sha: SHA });
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(captureFingerprint).toHaveBeenCalledOnce();
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("complete, bounded issue pagination", () => {
  it("returns issue context and occurrence guards without private fields", async () => {
    const result = await get();
    const data = await result.json();
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(data).toMatchObject({ version: 1, environment: "develop", releaseSha: SHA, totalOpen: 1, nextAfter: null, complete: true });
    expect(data.issues).toEqual([{ id: ID, source: issue.source, route: issue.route, message: issue.message, errorCode: "42501",
      detail: { stack: issue.detail.stack, password: "[redacted]" }, releaseSha: SHA, timesSeen: 20, firstSeenAt: STAMP, lastSeenAt: STAMP }]);
    expect(from.mock.calls.every(([table]) => table === "app_issues")).toBe(true);
    expect(is).toHaveBeenCalledWith("resolved_at", null);
    expect(order).toHaveBeenCalledWith("id", { ascending: true });
    expect(limit).toHaveBeenCalledWith(51);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns a stable ID cursor and a separate total rather than silently truncating", async () => {
    rows.mockResolvedValue({ data: [issue, { ...issue, id: ID2 }, { ...issue, id: ID3 }], error: null });
    total.mockResolvedValue({ count: 30, error: null });
    const first = await (await get("?action=issues&limit=2")).json();
    expect(first).toMatchObject({ totalOpen: 30, nextAfter: ID2, complete: false });
    expect(first.issues).toHaveLength(2);
    rows.mockResolvedValue({ data: [{ ...issue, id: ID3 }], error: null });
    const second = await (await get(`?action=issues&limit=2&after=${ID2}`)).json();
    expect(second).toMatchObject({ nextAfter: null, complete: true });
    expect(second.issues[0].id).toBe(ID3);
    expect(gt).toHaveBeenCalledWith("id", ID2);
  });

  it("reports an empty board explicitly", async () => {
    rows.mockResolvedValue({ data: [], error: null });
    total.mockResolvedValue({ count: 0, error: null });
    expect(await (await get()).json()).toMatchObject({ issues: [], totalOpen: 0, complete: true, nextAfter: null });
  });

  it.each(["?action=unknown", "?action=issues&limit=0", "?action=issues&limit=101", "?action=issues&limit=-1", "?action=issues&limit=01",
    "?action=issues&limit=1&limit=2", "?action=issues&after=bad", "?action=issues&offset=0", "?action=issues&action=issues"])("rejects malformed pagination: %s", async (query) => {
    expect((await get(query)).status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("accepts the maximum page size without exceeding its lookahead bound", async () => {
    expect((await get("?action=issues&limit=100")).status).toBe(200);
    expect(limit).toHaveBeenCalledWith(101);
  });

  it("fails loud on database failures without exposing their text", async () => {
    rows.mockResolvedValue({ data: null, error: { message: "private SQL and credentials" } });
    const result = await get();
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: "peer_issues_unavailable" });
    rows.mockResolvedValue({ data: [issue], error: null });
    total.mockResolvedValue({ count: null, error: { message: "private" } });
    expect((await get()).status).toBe(503);
  });

  it.each([{ data: [{ ...issue, times_seen: 0 }] }, { data: [{ ...issue, last_seen_at: "invalid" }] }, { data: [{ ...issue, id: "bad" }] }, { data: [issue, issue] }])("rejects malformed or duplicate returned records", async ({ data }) => {
    rows.mockResolvedValue({ data, error: null });
    expect((await get()).status).toBe(503);
  });
});

describe("guarded resolution", () => {
  it("changes only resolved_at, matching every inspected occurrence guard", async () => {
    const result = await post();
    const data = await result.json();
    expect(result.status).toBe(200);
    expect(data).toMatchObject({ version: 1, environment: "develop", releaseSha: SHA, id: ID });
    expect(Number.isFinite(Date.parse(data.resolvedAt))).toBe(true);
    expect(update).toHaveBeenCalledExactlyOnceWith({ resolved_at: data.resolvedAt });
    expect(eq.mock.calls).toEqual([["id", ID], ["times_seen", 20], ["last_seen_at", STAMP]]);
    expect(is).toHaveBeenCalledWith("resolved_at", null);
    expect(from).toHaveBeenCalledExactlyOnceWith("app_issues");
    expect(result.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a conflict for a recurrence, deletion or already-resolved issue", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await post();
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({ error: "issue_changed_or_already_resolved" });
    expect(update).toHaveBeenCalledOnce();
  });

  it.each([{ expectedReleaseSha: "b".repeat(40) }, { expectedEnvironment: "master" }])("rejects changed deployment identity before database access", async (change) => {
    const result = await post({ ...payload, ...change });
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({ error: "issue_deployment_changed" });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("does not resolve local or unversioned deployments", async () => {
    releaseSha.mockReturnValue(null);
    expect((await post()).status).toBe(409);
    environmentName.mockReturnValue("local");
    expect((await post({ ...payload, expectedEnvironment: "local" })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([null, [], {}, { ...payload, id: "bad" }, { ...payload, timesSeen: true }, { ...payload, timesSeen: -1 },
    { ...payload, lastSeenAt: "bad" }, { ...payload, resolved_at: STAMP }, { ...payload, action: "delete" }, { ...payload, expectedReleaseSha: null }])("rejects malformed or expanded write payloads", async (value) => {
    expect((await post(value)).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("bounds streamed bodies without trusting content-length", async () => {
    expect((await post({ ...payload, padding: "x".repeat(5000) })).status).toBe(413);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects unsupported media types and invalid JSON", async () => {
    expect((await post(payload, `Bearer ${SECRET}`, "text/plain")).status).toBe(415);
    const result = await POST(new NextRequest("https://fbc-pittsgrove.example/api/schema-fingerprint", { method: "POST", headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" }, body: "{" }));
    expect(result.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns unavailable rather than masking update errors as success", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "private credentials" } });
    const result = await post();
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: "peer_issues_unavailable" });
  });

  it("fails closed without a service client", async () => {
    createAdminClient.mockReturnValue(null);
    expect((await get()).status).toBe(503);
    expect((await post()).status).toBe(503);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("bounded issue sanitization", () => {
  it("removes credentials, URLs, queries, request bodies and identifiers while retaining useful diagnostics", () => {
    const result = sanitizeIssueDetail({ password: "hunter2", requestBody: { field: "private input" }, headers: { cookie: "session" },
      nested: { api_key: "secret", stack: 'Error {"password":"hunter2"} at https://user:pass@example.test/x?token=short Bearer private /admin/events?q=secret',
        code: "42501", route: "content.save.events" } });
    const encoded = JSON.stringify(result);
    for (const secret of ["hunter2", "private input", "session", "user:pass", "token=short", "Bearer private", "q=secret"]) expect(encoded).not.toContain(secret);
    expect(encoded).toContain("42501");
    expect(encoded).toContain("content.save.events");
  });

  it("bounds depth, string length, object size and arrays", () => {
    const value: Record<string, unknown> = { long: "x".repeat(20000), array: Array.from({ length: 100 }, () => "entry"), deep: { a: { b: { c: { d: { e: "stop" } } } } } };
    for (let i = 0; i < 100; i++) value[`key${i}`] = "x".repeat(1000);
    const result = sanitizeIssueDetail(value) as Record<string, unknown>;
    expect((result.array as unknown[]).length).toBe(20);
    expect(Object.keys(result).length).toBe(40);
    expect(JSON.stringify(result).length).toBeLessThan(16000);
    expect(JSON.stringify(result)).toContain("[truncated]");
  });
});
