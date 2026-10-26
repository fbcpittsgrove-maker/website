import { NextResponse } from "next/server";
import { reportIssue } from "@/lib/issues";
import { clientIp, underLimit } from "@/lib/auth/throttle";

/** Bodies are a route, a short message and a small detail blob; anything
 *  bigger is not a browser crash report. */
const MAX_BODY_BYTES = 16_384;

/** Distinct crash fingerprints one address may file per minute. */
const PER_IP_PER_MINUTE = 30;

/** Crash sink for client-side failures — they die in the browser, invisible
 *  to the server log, unless they POST here. Public and unauthenticated, but
 *  same-origin only, size-capped and per-IP throttled so it can't be used as
 *  an open log-spam or attribution sink. */
export async function POST(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  const siteHost = new URL(siteUrl).host;

  // A browser fetch() POST always carries Origin; its absence means a script.
  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.json({ ok: false }, { status: 403 });
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = null;
  }
  if (originHost !== siteHost) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  const allowed = await underLimit(
    `report-issue:${clientIp(request.headers)}`,
    PER_IP_PER_MINUTE,
    60,
  );
  if (!allowed) return NextResponse.json({ ok: false }, { status: 429 });

  try {
    const body = JSON.parse(raw) as {
      route?: string;
      message?: string;
      detail?: unknown;
    };
    if (!body.message) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    let detail: string | undefined;
    if (body.detail !== undefined) {
      try {
        detail = JSON.stringify(body.detail).slice(0, 4096);
      } catch {
        detail = String(body.detail).slice(0, 4096);
      }
    }

    await reportIssue({
      source: "client",
      route: body.route,
      message: String(body.message).slice(0, 500),
      detail,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
