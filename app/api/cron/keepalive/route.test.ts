import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const select = vi.fn();
const reportIssue = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select }) }),
}));
vi.mock("@/lib/issues", () => ({ reportIssue }));

const { GET } = await import("@/app/api/cron/keepalive/route");

function call(authorization?: string) {
  return GET(
    new NextRequest("https://fbc-pittsgrove.example/api/cron/keepalive", {
      headers: authorization ? { authorization } : {},
    }),
  );
}

beforeEach(() => {
  vi.unstubAllEnvs();
  select.mockReset();
  reportIssue.mockReset();
});

describe("/api/cron/keepalive", () => {
  it("refuses to run with no CRON_SECRET configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await call("Bearer anything");
    expect(res.status).toBe(503);
    expect(select).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong bearer", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    expect(select).not.toHaveBeenCalled();
  });

  it("touches the database once with the right bearer", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    select.mockResolvedValue({ error: null });
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("fails loud and logs the issue when the read fails", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    select.mockResolvedValue({ error: { message: "project paused", code: "PGRST000" } });
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(500);
    expect(reportIssue).toHaveBeenCalledWith(expect.objectContaining({ route: "/api/cron/keepalive", message: "project paused" }));
  });
});
