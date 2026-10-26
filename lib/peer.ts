/**
 * Server-to-server calls to the peer deployment (SCHEMA_PEER_URL +
 * SCHEMA_PEER_SECRET) — used by the diagnostics drift check and the
 * canonical roadmap board proxy.
 *
 * Redirects are followed BY HAND because fetch strips the Authorization
 * header on cross-host redirects — a custom domain's vercel.app URL 307s and
 * silently turns an authenticated peer call into a 401. A hop is only
 * followed to the SAME origin as the configured peer URL: the shared board
 * secret never travels to a different host, and a cross-host redirect is
 * raised as an explicit error rather than silently swallowed.
 */

export function peerConfigured(): boolean {
  return Boolean(process.env.SCHEMA_PEER_URL?.trim() && process.env.SCHEMA_PEER_SECRET?.trim());
}

const MAX_HOPS = 3;

/** Scheme + host + port a request may carry the peer secret to. Anything
 *  else is a different destination and is refused. */
function originOf(url: URL): string {
  return `${url.protocol}//${url.host}`;
}

export async function peerFetch(path: string, init?: RequestInit): Promise<Response> {
  const secret = process.env.SCHEMA_PEER_SECRET!.trim();
  const base = new URL(`${process.env.SCHEMA_PEER_URL!.trim().replace(/\/+$/, "")}${path}`);
  const trustedOrigin = originOf(base);
  let url = base.toString();

  for (let hop = 0; ; hop++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...((init?.headers as Record<string, string>) ?? {}),
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      redirect: "manual",
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const next = new URL(location, url);
      if (originOf(next) !== trustedOrigin) {
        throw new Error(
          `Peer call refused a cross-host redirect to ${next.origin} — the secret only travels to ${trustedOrigin}.`,
        );
      }
      if (hop >= MAX_HOPS) {
        throw new Error(`Peer call exceeded ${MAX_HOPS} same-host redirects.`);
      }
      url = next.toString();
      continue;
    }
    return res;
  }
}
