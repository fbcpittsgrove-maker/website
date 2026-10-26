import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isMfaPending } from "@/lib/auth/mfa";

// The church site is public; only the signed-in surfaces sit behind a login.
// Everything else (the public pages, /auth email links, the peer endpoints
// that self-authenticate with a Bearer secret, /manifest.webmanifest) passes
// straight through without touching the session.
const PROTECTED_PATHS = ["/admin", "/account"];

/** Sign-in and email-link pages get the CSP too, though they're reachable logged-out. */
const CSP_PUBLIC_PATHS = ["/login", "/update-password", "/forgot-password", "/auth/confirm", "/auth/finish"];

/**
 * Nonce CSP for the signed-in surface. Public pages are left alone — a nonce
 * forces dynamic rendering.
 */
function policy(nonce: string): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabase) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  const canonicalUrl = process.env.NEXT_PUBLIC_CANONICAL_SUPABASE_URL;
  if (!canonicalUrl) throw new Error("NEXT_PUBLIC_CANONICAL_SUPABASE_URL is not set");
  const dev = process.env.NODE_ENV !== "production";

  // Off-prod, roadmap attachments upload straight to the canonical (prod)
  // project's storage — a second Supabase origin. On prod it's the same one.
  const origin = [
    ...new Set([new URL(supabase).origin, new URL(canonicalUrl).origin]),
  ].join(" ");

  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${origin}`,
    `font-src 'self'`,
    `connect-src 'self' ${origin} ${new URL(supabase).origin.replace(/^https:/, "wss:")}${dev ? " ws:" : ""}`,
    `worker-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Next 16 Proxy. Refreshes the Supabase session on the signed-in surfaces and
 * the sign-in pages, then gates them: unauthenticated requests go to /login, and a password-only
 * session on an account with an authenticator goes back to /login's code step.
 * Do not add logic between createServerClient and getClaims().
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (!isProtected && !CSP_PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const csp = isProtected || CSP_PUBLIC_PATHS.includes(pathname)
    ? policy(Buffer.from(crypto.randomUUID()).toString("base64"))
    : null;

  // Next reads the nonce off the request's CSP header and stamps it on its
  // own scripts.
  const requestHeaders = new Headers(request.headers);
  if (csp) requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const authHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.assign(authHeaders, headers);
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  const { data: claims } = await supabase.auth.getClaims();

  /** A redirect is a fresh response, so a token refreshed during this request
   *  is lost unless its cookies and no-store headers are carried across. */
  function redirectTo(target: string) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    Object.entries(authHeaders).forEach(([key, value]) => redirect.headers.set(key, value));
    return redirect;
  }

  if (!claims && isProtected) return redirectTo("/login");

  /** A password-only session on an account with an authenticator is not signed
   *  in yet — it goes back to /login, which picks up at the code step. */
  const mfaPending = claims ? await isMfaPending(supabase, claims.claims.aal) : false;

  if (mfaPending && isProtected) return redirectTo("/login");

  /** /login with an ?error= is the escape hatch a deactivated or profile-less
   *  session is sent to. Bouncing it back to /admin would loop forever, so let it
   *  render the error and its sign-out action. */
  const loginHasError =
    pathname === "/login" && request.nextUrl.searchParams.has("error");

  if (pathname === "/login" && claims && !mfaPending && !loginHasError)
    return redirectTo("/admin");

  if (csp) response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
