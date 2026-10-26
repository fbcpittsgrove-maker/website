import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { captureFingerprint } from "@/lib/schema-fingerprint";
import { listPeerIssues, resolvePeerIssue } from "@/lib/peer-issues";

export const dynamic = "force-dynamic";

/**
 * Peer endpoint for the drift check: returns this environment's structural
 * snapshot to the *other* environment. Authenticated by a shared secret
 * (SCHEMA_PEER_SECRET, identical on both) — the caller is a server, not a
 * person. Structure only, no row data.
 */
function secretMatches(header: string | null): boolean {
  const expected = process.env.SCHEMA_PEER_SECRET;
  if (!expected || !header) return false;
  const given = header.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!secretMatches(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (new URL(request.url).searchParams.has("action")) return listPeerIssues(request);
  return NextResponse.json(await captureFingerprint(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!secretMatches(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return resolvePeerIssue(request);
}
