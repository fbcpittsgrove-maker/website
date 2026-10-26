/** Same-origin path or the fallback. A bare prefix check lets `/\evil.com`
 *  through — browsers normalise the backslash and land on evil.com — so the
 *  value is resolved against a dummy origin and must stay on it. Pure: safe
 *  to import from client components. */
export function safeNext(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.includes("\\")) return fallback;
  const url = new URL(raw, "http://local.invalid");
  if (url.origin !== "http://local.invalid" || url.pathname.startsWith("//")) return fallback;
  return url.pathname + url.search + url.hash;
}
