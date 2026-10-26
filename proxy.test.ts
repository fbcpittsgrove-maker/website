import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getClaims = vi.fn();
const createServerClient = vi.fn(() => ({ auth: { getClaims } }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@/lib/auth/mfa", () => ({ isMfaPending: vi.fn(async () => false) }));

const { proxy } = await import("@/proxy");

function request(path: string) {
  return new NextRequest(`https://fbc-pittsgrove.example${path}`);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://dev.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("NEXT_PUBLIC_CANONICAL_SUPABASE_URL", "https://prod.supabase.co");
  getClaims.mockReset();
  createServerClient.mockClear();
});

describe("proxy", () => {
  it("serves public pages without touching the session", async () => {
    for (const path of ["/", "/api/roadmap", "/api/cron/keepalive", "/manifest.webmanifest"]) {
      const res = await proxy(request(path));
      expect(res.headers.get("location")).toBeNull();
    }
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor on an admin page to /login", async () => {
    getClaims.mockResolvedValue({ data: null });
    for (const path of ["/admin", "/admin/events", "/account"]) {
      const res = await proxy(request(path));
      expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    }
  });

  it("lets a signed-in member through to admin pages with a nonce CSP", async () => {
    getClaims.mockResolvedValue({ data: { claims: { aal: "aal1" } } });
    const res = await proxy(request("/admin/sermons"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-security-policy")).toMatch(/'nonce-[^']+'/);
  });

  it("does not mistake a lookalike path for the admin area", async () => {
    const res = await proxy(request("/administration-office"));
    expect(res.headers.get("location")).toBeNull();
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("moves a signed-in member off /login to /admin", async () => {
    getClaims.mockResolvedValue({ data: { claims: { aal: "aal1" } } });
    const res = await proxy(request("/login"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin");
  });
});
