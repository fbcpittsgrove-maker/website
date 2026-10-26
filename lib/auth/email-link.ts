import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";

/**
 * Landing handler for every emailed auth link — invites and password resets.
 *
 * Supabase can hand us the session three different ways, and only one of them
 * works server-side without help:
 *
 *  1. `?token_hash=…&type=invite` — the SSR flow. Sent to the /auth/confirm
 *     interstitial, which spends the token only on a button POST, so
 *     mail-scanner GET prefetches can't burn the single-use token.
 *  2. `?code=…` — the PKCE flow (OAuth, and magic links started in-browser).
 *  3. Nothing in the query string — Supabase's *implicit* flow, which puts the
 *     tokens in the URL fragment. Fragments never reach a server, so that
 *     case finishes in the browser at /auth/finish.
 */

export const EMAIL_OTP_TYPES = [
  "invite",
  "recovery",
  "signup",
  "magiclink",
  "email",
  "email_change",
] as const;

const isOtpType = (v: string): v is EmailOtpType =>
  (EMAIL_OTP_TYPES as readonly string[]).includes(v);

export async function handleEmailLink(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"), "/update-password");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  if (tokenHash && type && isOtpType(type)) {
    const params = new URLSearchParams({ token_hash: tokenHash, type, next });
    return NextResponse.redirect(`${origin}/auth/confirm?${params}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?error=link`);
  }

  // Implicit flow: the tokens are in the fragment. A browser carries the
  // fragment across a redirect whose Location header has none, so it survives
  // this hop and /auth/finish can read it.
  return NextResponse.redirect(`${origin}/auth/finish?next=${encodeURIComponent(next)}`);
}
