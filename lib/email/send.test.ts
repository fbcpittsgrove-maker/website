import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearEmailGateCache, sendEmail } from "./send";

const { createAdminClient, reportIssue } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  reportIssue: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/issues", () => ({ reportIssue }));

const input = {
  to: "manny@thesoftwareeffect.com",
  subject: "Church email test",
  html: "<p>Email test</p>",
  trigger: "invite",
};

describe("Resend email delivery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearEmailGateCache();
    createAdminClient.mockReturnValue(null);
    reportIssue.mockResolvedValue(undefined);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("RESEND_FROM", "FBC Pittsgrove <no-reply@fbc-pittsgrove.example>");
    vi.stubEnv("EMAIL_DEV_REDIRECT", undefined);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    clearEmailGateCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([undefined, ""])("refuses an absent or blank key (%s) without contacting Resend", async (key) => {
    vi.stubEnv("RESEND_API_KEY", key);

    expect(await sendEmail(input)).toEqual({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
    expect(reportIssue).toHaveBeenCalledWith(expect.objectContaining({
      message: "RESEND_API_KEY is not set",
      detail: { trigger: "invite" },
    }));
  });

  it("refuses a missing sender without contacting Resend", async () => {
    vi.stubEnv("RESEND_FROM", undefined);

    expect(await sendEmail(input)).toEqual({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
    expect(reportIssue).toHaveBeenCalledWith(expect.objectContaining({ message: "RESEND_FROM is not set" }));
  });

  it("sends production mail to the actual recipient with the configured sender", async () => {
    vi.stubEnv("EMAIL_DEV_REDIRECT", "dev@thesoftwareeffect.com");
    vi.mocked(fetch).mockResolvedValue(Response.json({ id: "mail-id" }));

    expect(await sendEmail(input)).toEqual({ ok: true, id: "mail-id" });
    expect(fetch).toHaveBeenCalledExactlyOnceWith("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer test-key", "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "FBC Pittsgrove <no-reply@fbc-pittsgrove.example>",
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });
  });

  it.each(["preview", undefined])("redirects develop and local mail (%s) to the dev inbox", async (environment) => {
    vi.stubEnv("VERCEL_ENV", environment);
    vi.stubEnv("EMAIL_DEV_REDIRECT", "dev@thesoftwareeffect.com");
    vi.mocked(fetch).mockResolvedValue(Response.json({ id: "mail-id" }));

    expect(await sendEmail(input)).toEqual({ ok: true, id: "mail-id" });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      from: "FBC Pittsgrove <no-reply@fbc-pittsgrove.example>",
      to: "dev@thesoftwareeffect.com",
      subject: `[for ${input.to}] ${input.subject}`,
      html: input.html,
    });
  });

  it("refuses develop mail without a dev redirect", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");

    expect(await sendEmail(input)).toEqual({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
    expect(reportIssue).toHaveBeenCalledWith(expect.objectContaining({
      message: `refusing to send to ${input.to} outside production with no EMAIL_DEV_REDIRECT`,
    }));
  });

  it("honors the email kill switch without contacting Resend", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { value: { master: false } }, error: null });
    createAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
      }),
    });

    expect(await sendEmail(input)).toEqual({ ok: true, skipped: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports provider rejection rather than claiming delivery", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("Invalid API key", { status: 401 }));

    expect(await sendEmail(input)).toEqual({ ok: false });
    expect(reportIssue).toHaveBeenCalledWith(expect.objectContaining({
      message: "resend 401: Invalid API key",
      detail: { trigger: "invite", to: input.to },
    }));
  });

  it("reports a network failure rather than claiming delivery", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("connection failed"));

    expect(await sendEmail(input)).toEqual({ ok: false });
    expect(reportIssue).toHaveBeenCalledWith(expect.objectContaining({ message: "connection failed" }));
  });
});
