import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportIssue } from "@/lib/issues";

export const dynamic = "force-dynamic";

/**
 * Daily keepalive. Supabase Free pauses a project after a week with no API
 * traffic, and the public site alone may not hit the database that often.
 * One cheap read a day keeps production awake. Bearer CRON_SECRET only —
 * with no secret configured the route refuses to run (503).
 */
function authState(request: NextRequest): "unset" | "denied" | "ok" {
  const expected = process.env.CRON_SECRET;
  if (!expected) return "unset";
  const header = request.headers.get("authorization");
  if (!header) return "denied";
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want) ? "ok" : "denied";
}

export async function GET(request: NextRequest) {
  const auth = authState(request);
  if (auth === "unset") return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (auth !== "ok") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 503 });

  const { error } = await admin.from("email_settings").select("key", { count: "exact", head: true });
  if (error) {
    await reportIssue({ source: "route", route: "/api/cron/keepalive", message: error.message, errorCode: error.code });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
